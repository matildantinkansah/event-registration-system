"""
POST /register
Body: { "eventId": "...", "email": "..." }

What this does, step by step:
 1. Validates the input (eventId and a real-looking email are required).
 2. Looks up the event in EventsTable to make sure it exists and isn't full.
 3. Atomically increments the event's registeredCount (ConditionExpression
    stops two people grabbing the "last seat" at the same time - this is a
    common real-world race condition).
 4. Saves the registration in RegistrationsTable.
 5. Publishes a message to SNS so the organizer gets an email notification.
"""

import json
import os
import re
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")

events_table = dynamodb.Table(os.environ["EVENTS_TABLE"])
registrations_table = dynamodb.Table(os.environ["REGISTRATIONS_TABLE"])
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN")

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def response(status_code: int, body_dict: dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body_dict),
    }


def lambda_handler(event, context):
    # --- 1. Parse and validate input -----------------------------------
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON in request body"})

    event_id = (body.get("eventId") or "").strip()
    email = (body.get("email") or "").strip()

    if not event_id or not email:
        return response(400, {"error": "eventId and email are required"})

    if not re.match(EMAIL_REGEX, email):
        return response(400, {"error": "Please provide a valid email address"})

    # --- 2. Look up the event -------------------------------------------
    event_item = events_table.get_item(Key={"eventId": event_id}).get("Item")
    if not event_item:
        return response(404, {"error": "Event not found"})

    capacity = int(event_item.get("capacity", 0))
    registered = int(event_item.get("registeredCount", 0))

    if registered >= capacity:
        return response(409, {"error": "Sorry, this event is fully booked"})

    # --- 3. Atomically reserve a spot ------------------------------------
    try:
        events_table.update_item(
            Key={"eventId": event_id},
            UpdateExpression="SET registeredCount = registeredCount + :inc",
            ConditionExpression="registeredCount < capacity",
            ExpressionAttributeValues={":inc": 1},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return response(409, {"error": "Sorry, this event just filled up"})
        raise

    # --- 4. Save the registration -----------------------------------------
    registration_id = str(uuid.uuid4())
    registrations_table.put_item(
        Item={
            "registrationId": registration_id,
            "eventId": event_id,
            "eventName": event_item.get("eventName"),
            "email": email,
            "registeredAt": datetime.now(timezone.utc).isoformat(),
        }
    )

    # --- 5. Notify the organizer via SNS (best effort - never block on this) ---
    if SNS_TOPIC_ARN:
        try:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=f"New registration: {event_item.get('eventName')}",
                Message=(
                    f"{email} just registered for '{event_item.get('eventName')}'.\n"
                    f"Registration ID: {registration_id}\n"
                    f"Event date: {event_item.get('eventDate')}"
                ),
            )
        except Exception:
            pass  # Don't fail the registration just because the email notification failed

    return response(
        201,
        {
            "message": "Registration successful",
            "registrationId": registration_id,
            "eventId": event_id,
            "eventName": event_item.get("eventName"),
        },
    )
