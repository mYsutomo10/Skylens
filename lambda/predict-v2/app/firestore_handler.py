import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime, timedelta

def init_firestore():
    if not firebase_admin._apps:
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
            cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()

db = None
def get_db():
    global db
    if db is None:
        db = init_firestore()
    return db

def get_nearest_doc(sensor_id, target_time):
    db_client = get_db()
    collection = db_client.collection(f"current_data/{sensor_id}/main")

    closest_doc = None
    closest_diff = timedelta.max
    selected_ts_str = None

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

def fetch_sensor_data(sensor_id, reference_time, hours_needed=77):
    raw_data = []
    current_time = reference_time
    hours_checked = 0

    while len(raw_data) < hours_needed and hours_checked < 100:
        target_time = current_time.replace(minute=0, second=0, microsecond=0)
        ts_str, doc_data = get_nearest_doc(sensor_id, target_time)

        if doc_data:
            doc_data["timestamp"] = ts_str
            raw_data.insert(0, doc_data)
        else:
            print(f"[{sensor_id}] No data found near {target_time.strftime('%Y-%m-%d %H:%M')}. Searching further back.")
        
        current_time -= timedelta(hours=1)
        hours_checked += 1
    
    if len(raw_data) > hours_needed:
        raw_data = raw_data[-hours_needed:]

    print(f"[{sensor_id}] Retrieved {len(raw_data)} records from Firestore")
    
    if len(raw_data) < hours_needed:
        print(f"[{sensor_id}] WARNING: Only found {len(raw_data)} out of {hours_needed} required data points. Prediction may fail or be inaccurate.")

    return raw_data

def save_forecast(sensor_id, timestamp, forecast_data, location_data):
    db_client = get_db()
    forecast_collection = db_client.collection(f"forecast_data/{sensor_id}/main")

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