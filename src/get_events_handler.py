"""
GET /events
Reads every event from the EventsTable in DynamoDB and returns them as JSON,
along with a computed "status" (Available / Limited / Full) so the frontend
can show colored badges - just like the mockup in the project brief.
"""

import json
import os
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb")
events_table = dynamodb.Table(os.environ["EVENTS_TABLE"])


def decimal_default(obj):
    """DynamoDB returns numbers as Decimal objects, which json.dumps can't
    handle by default. This converts them to normal int/float."""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def compute_status(capacity: int, registered: int) -> str:
    remaining = capacity - registered
    if remaining <= 0:
        return "Full"
    if remaining <= max(1, int(capacity * 0.2)):  # 20% or fewer spots left
        return "Limited"
    return "Available"


def lambda_handler(event, context):
    try:
        result = events_table.scan()
        items = result.get("Items", [])

        events = []
        for item in items:
            capacity = int(item.get("capacity", 0))
            registered = int(item.get("registeredCount", 0))
            events.append(
                {
                    "eventId": item.get("eventId"),
                    "eventName": item.get("eventName"),
                    "eventDate": item.get("eventDate"),
                    "venue": item.get("venue", ""),
                    "description": item.get("description", ""),
                    "capacity": capacity,
                    "registeredCount": registered,
                    "status": compute_status(capacity, registered),
                }
            )

        # Sort by date so the list looks tidy
        events.sort(key=lambda e: e.get("eventDate") or "")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"events": events}, default=decimal_default),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
