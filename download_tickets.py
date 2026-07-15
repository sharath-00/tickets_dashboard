#!/usr/bin/env python3
"""
Syncs ticket data directly from the Firebase Firestore 'smartlights' database.
Supports cursor-based query pagination and filtering by region.
"""

import requests
import csv
from datetime import datetime
import os
import sys
import argparse

PROJECT_ID = "schnelliot-380113"
DATABASE_ID = "smartlights"
CSV_PATH = os.path.abspath("main.csv")

def get_field_val(doc, field_name, default=""):
    fields = doc.get("fields", {})
    if field_name not in fields:
        return default
    val_dict = fields[field_name]
    for k, v in val_dict.items():
        if k == "arrayValue":
            return str(v.get("values", []))
        elif k == "mapValue":
            return str(v.get("fields", {}))
        else:
            return str(v)
    return default

def get_available_regions():
    """Quickly scans the first 2000 documents to suggest valid region names"""
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents:runQuery"
    payload = {
        "structuredQuery": {
            "from": [{"collectionId": "tickets"}],
            "select": {"fields": [{"fieldPath": "region"}]},
            "limit": 2000
        }
    }
    regions = set()
    try:
        r = requests.post(url, json=payload, timeout=15)
        if r.status_code == 200:
            for item in r.json():
                if "document" in item:
                    reg = get_field_val(item["document"], "region")
                    if reg:
                        regions.add(reg)
    except:
        pass
    return sorted(list(regions))

def download_tickets():
    parser = argparse.ArgumentParser(description="Sync Tickets from Firebase Firestore.")
    parser.add_argument("-r", "--region", type=str, help="Specific region to download tickets for (e.g. GOA, Thirutanni, TUP)")
    parser.add_argument("-l", "--limit", type=int, help="Limit total number of tickets to download")
    args = parser.parse_args()

    region_filter = args.region
    max_limit = args.limit

    print("Initiating Firestore runQuery sync...")
    if region_filter:
        print(f"Filtering tickets for region: '{region_filter}'")
    else:
        print("Downloading tickets for ALL regions...")

    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{DATABASE_ID}/documents:runQuery"
    
    # Base structured query payload
    structured_query = {
        "from": [{"collectionId": "tickets"}],
        "orderBy": [{"field": {"fieldPath": "__name__"}, "direction": "ASCENDING"}],
        "limit": 1000
    }
    
    # Apply server-side region filter if specified
    if region_filter:
        structured_query["where"] = {
            "fieldFilter": {
                "field": {"fieldPath": "region"},
                "op": "EQUAL",
                "value": {"stringValue": region_filter}
            }
        }

    all_docs = []
    page = 1
    last_doc_name = None

    while True:
        # If limit is specified and we reached it, stop
        if max_limit and len(all_docs) >= max_limit:
            break
            
        # Adjust limit for last page if needed
        if max_limit:
            remaining = max_limit - len(all_docs)
            structured_query["limit"] = min(1000, remaining)
            if structured_query["limit"] <= 0:
                break

        # Apply cursor pagination starting after last document
        if last_doc_name:
            structured_query["startAt"] = {
                "values": [{"referenceValue": last_doc_name}],
                "before": False
            }

        payload = {"structuredQuery": structured_query}
        print(f"Fetching batch {page} (downloaded {len(all_docs)} tickets)...")
        
        try:
            r = requests.post(url, json=payload, timeout=30)
            if r.status_code != 200:
                print(f"Error fetching batch {page}: {r.status_code} - {r.text}")
                sys.exit(1)
        except Exception as e:
            print(f"Network error on batch {page}: {e}")
            sys.exit(1)

        results = r.json()
        
        # Parse documents from runQuery response format
        batch_docs = [item["document"] for item in results if "document" in item]
        
        if not batch_docs:
            break
            
        all_docs.extend(batch_docs)
        
        # If the batch returned fewer documents than requested, we reached the end
        if len(batch_docs) < structured_query["limit"]:
            break
            
        last_doc_name = batch_docs[-1]["name"]
        page += 1

    if not all_docs:
        print("\nNo tickets found matching the criteria.")
        if region_filter:
            print("Checking database for valid region names...")
            available = get_available_regions()
            if available:
                print("Available regions in the database:")
                for reg in available:
                    print(f"  - {reg}")
            else:
                print("Could not query region names. Please verify spelling and casing.")
        sys.exit(0)

    print(f"Successfully retrieved {len(all_docs)} tickets. Formatting data...")
    
    rows = []
    for doc in all_docs:
        ticket_no = get_field_val(doc, "ticket_id")
        if not ticket_no:
            continue
            
        region = get_field_val(doc, "region")
        zone = get_field_val(doc, "zone")
        ward = get_field_val(doc, "ward")
        complainee = get_field_val(doc, "complainee")
        
        ent_type = get_field_val(doc, "entity_type")
        if ent_type.lower() == "slc":
            device_type = "SLC Panel"
        elif ent_type.lower() == "ccms":
            device_type = "CCMS"
        else:
            device_type = ent_type
            
        device_name = get_field_val(doc, "entity_name")
        prob_type = get_field_val(doc, "problem_type")
        status = get_field_val(doc, "status")
        priority = get_field_val(doc, "priority")
        
        assignee = get_field_val(doc, "assignee")
        if not assignee or assignee.strip().lower() in ["", "unassigned"]:
            assignee = "Unassigned"
            
        opened_time = get_field_val(doc, "ticket_opened_on")
        closed_time = get_field_val(doc, "ticket_closed_on")
        
        duration = 0
        if opened_time and closed_time:
            try:
                fmt = "%Y-%m-%d %H:%M:%S"
                op_dt = datetime.strptime(opened_time.split(".")[0].strip(), fmt)
                cl_dt = datetime.strptime(closed_time.split(".")[0].strip(), fmt)
                duration = (cl_dt - op_dt).days
                if duration < 0:
                    duration = 0
            except Exception:
                duration = 0
                
        location = get_field_val(doc, "location")
        comments = get_field_val(doc, "comments")
        phone = get_field_val(doc, "complainee_contact_no")
        customer = get_field_val(doc, "customer")
        customer_id = get_field_val(doc, "customer_id")
        
        rows.append({
            "Ticket No": ticket_no,
            "Region": region,
            "Zone": zone,
            "Ward": ward,
            "Complainee": complainee,
            "Device/Asset Type": device_type,
            "Device/Asset Name": device_name,
            "Problem Type": prob_type,
            "Status": status,
            "Priority": priority,
            "Assignee": assignee,
            "Customer": customer,
            "Customer ID": customer_id,
            "Opened Time": opened_time,
            "Closed Time": closed_time,
            "Duration (Days)": duration,
            "Location": location,
            "Latest Comments": comments,
            "Complainee Phone Number": phone
        })
        
    print("Sorting tickets chronologically (newest first)...")
    rows.sort(key=lambda x: x["Opened Time"], reverse=True)
    
    headers = [
        "Ticket No", "Region", "Zone", "Ward", "Complainee",
        "Device/Asset Type", "Device/Asset Name", "Problem Type",
        "Status", "Priority", "Assignee", "Customer", "Customer ID", "Opened Time", "Closed Time",
        "Duration (Days)", "Location", "Latest Comments", "Complainee Phone Number"
    ]
    
    print(f"Writing {len(rows)} tickets to {CSV_PATH}...")
    try:
        with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        print("Sync complete. main.csv has been updated.")
    except Exception as e:
        print(f"Error writing CSV file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    download_tickets()
