"""
Run this ONCE, locally, after your first deployment, to put some sample
events into your EventsTable (DynamoDB starts empty - there's no "seed data"
button in the console for this, so we do it with a small script).

HOW TO RUN:
    1. Make sure you've run `aws configure` already (see README.md).
    2. Install boto3 if you don't have it:  pip install boto3
    3. Run:  python scripts/seed_events.py

Note: venue and description are optional extra fields shown on the
frontend. Your Lambda functions already pass through any fields you add
here, since get_events_handler.py reads them dynamically.
"""

import uuid

import boto3

# Change this if you deployed to a different AWS region
REGION = "us-east-1"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table("EventsTable")

events = [
    {
        "eventId": str(uuid.uuid4()),
        "eventName": "AWS Workshop Accra 2026",
        "eventDate": "2026-05-15",
        "venue": "Kempinski Hotel Gold Coast City, Accra",
        "description": "A hands-on workshop covering AWS cloud fundamentals, serverless architecture, and real deployment practice.",
        "capacity": 50,
        "registeredCount": 0,
    },
    {
        "eventId": str(uuid.uuid4()),
        "eventName": "Cloud Solutions Summit",
        "eventDate": "2026-06-28",
        "venue": "Accra International Conference Centre",
        "description": "A one-day conference featuring cloud computing, artificial intelligence, cybersecurity, and DevOps tracks.",
        "capacity": 30,
        "registeredCount": 25,
    },
    {
        "eventId": str(uuid.uuid4()),
        "eventName": "Ghana Tech Leaders Forum",
        "eventDate": "2026-10-10",
        "venue": "Labadi Beach Hotel, Accra",
        "description": "A leadership forum bringing together technology professionals, entrepreneurs, and investors shaping Ghana's tech scene.",
        "capacity": 80,
        "registeredCount": 12,
    },
]

for e in events:
    table.put_item(Item=e)
    print(f"Added: {e['eventName']}  (eventId: {e['eventId']})")

print("\nDone. Refresh your frontend and these events should appear.")
