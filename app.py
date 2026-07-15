from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
import os
import csv
from datetime import datetime

HOST = "127.0.0.1"
PORT = 8000
CSV_PATH = "main.csv"
CSV_COLUMNS = [
    "Ticket No", "Region", "Zone", "Ward", "Complainee", "Device/Asset Type",
    "Device/Asset Name", "Problem Type", "Status", "Priority", "Assignee",
    "Customer", "Customer ID", "Opened Time", "Closed Time", "Duration (Days)",
    "Location", "Latest Comments", "Complainee Phone Number"
]


def merge_and_save_tickets(new_tickets):
    """Safely merge new tickets into main.csv on disk, preventing duplicates"""
    existing_tickets = []
    existing_numbers = set()
    
    if os.path.exists(CSV_PATH):
        try:
            with open(CSV_PATH, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    ticket_no = row.get("Ticket No")
                    if ticket_no:
                        existing_tickets.append(row)
                        existing_numbers.add(ticket_no)
        except Exception as e:
            print(f"Error reading existing main.csv: {e}")
            
    added_count = 0
    for t in new_tickets:
        ticket_no = t.get("Ticket No")
        if ticket_no and ticket_no not in existing_numbers:
            existing_tickets.append(t)
            existing_numbers.add(ticket_no)
            added_count += 1
            
    if added_count > 0 or not os.path.exists(CSV_PATH):
        try:
            temp_path = CSV_PATH + ".tmp"
            with open(temp_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writeheader()
                for t in existing_tickets:
                    row = {col: t.get(col, "") for col in CSV_COLUMNS}
                    writer.writerow(row)
            
            if os.path.exists(CSV_PATH):
                os.remove(CSV_PATH)
            os.rename(temp_path, CSV_PATH)
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Saved {added_count} new tickets. Total tickets in main.csv: {len(existing_tickets)}")
        except Exception as e:
            print(f"Error saving tickets to main.csv: {e}")
            
    return added_count


class TicketServerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/upload':
            self.handle_upload_request()
        elif self.path == '/api/clear':
            self.handle_clear_request()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_upload_request(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            tickets = json.loads(post_data.decode('utf-8'))
            
            if not isinstance(tickets, list):
                self.send_error_response(400, "Invalid payload format. Expected a list of tickets.")
                return
            
            added_count = merge_and_save_tickets(tickets)
            self.send_json_response(200, {"success": True, "added_count": added_count})
        except Exception as e:
            self.send_error_response(500, f"Error processing upload: {str(e)}")

    def handle_clear_request(self):
        try:
            with open(CSV_PATH, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writeheader()
            self.send_json_response(200, {"success": True, "message": "Database cleared successfully."})
        except Exception as e:
            self.send_error_response(500, f"Error clearing database: {str(e)}")

    def send_json_response(self, code, obj):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode('utf-8'))

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))


def main():
    server = ThreadingHTTPServer((HOST, PORT), TicketServerHandler)

    print("Smart Light Ticket Monitoring System API Server")
    print(f"Serving at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
