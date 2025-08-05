import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
import google.cloud.storage as storage
from datetime import datetime, timedelta

def init_firestore():
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if not cred_path:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.")

    try:
        cred_json = json.loads(cred_path)
        cred = credentials.Certificate(cred_json)
    except json.JSONDecodeError:
        cred = credentials.Certificate(cred_path)

    firebase_admin.initialize_app(cred)
    print(f"Firestore initialized.")
    
    return firestore.client()

try:
    db = init_firestore()
except ValueError as e:
    print(f"Error initializing Firestore: {e}")
    db = None

# Find the Firestore document with the timestamp closest to HH:00
def get_nearest_doc(sensor_id, target_time):
    collection = db.collection(f"current_data/{sensor_id}/main")

    closest_doc = None
    closest_diff = timedelta.max
    selected_ts_str = None

    # Try a range of ±30 minutes (61 search points: -30 to +30)
    for offset_min in range(-30, 31):
        check_time = target_time + timedelta(minutes=offset_min)
        ts_str = check_time.strftime("%Y%m%dT%H%M")
        doc = collection.document(ts_str).get()
        if doc.exists:
            diff = abs(check_time - target_time)
            if diff < closest_diff:
                closest_diff = diff
                closest_doc = doc.to_dict()
                selected_ts_str = ts_str

    if closest_doc:
        return selected_ts_str, closest_doc
    return None, None

# Fetch 72 hours of historical data with a flexible time tolerance of ±30 minutes
def fetch_sensor_data(sensor_id, reference_time, hours_back=77):
    raw_data = []
    current_time = reference_time

    for _ in range(hours_back):
        target_time = current_time.replace(minute=0, second=0, microsecond=0)
        ts_str, doc_data = get_nearest_doc(sensor_id, target_time)
        if doc_data:
            doc_data["timestamp"] = ts_str
            raw_data.insert(0, doc_data)
        else:
            print(f"[{sensor_id}] No data found near {target_time.strftime('%Y-%m-%d %H:%M')}")
        current_time -= timedelta(hours=1)

    print(f"[{sensor_id}] Retrieved {len(raw_data)} records from Firestore")
    return raw_data

# Save the forecast results to Firestore
def save_forecast(sensor_id, timestamp, forecast_data, location_data):
    forecast_collection = db.collection(f"forecast_data/{sensor_id}/main")

    for i, forecast in enumerate(forecast_data):
        forecast_ts = timestamp + timedelta(hours=i+1)
        forecast_ts_str = forecast_ts.strftime("%Y%m%dT%H%M")
        doc = {
            "timestamp": forecast_ts,
            "aqi": int(round(forecast)),
            "location": location_data,
            "id": sensor_id,
        }
        forecast_collection.document(forecast_ts_str).set(doc)
        print(f"[{sensor_id}] Forecast saved at {forecast_ts_str}")