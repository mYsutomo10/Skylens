import firebase_admin
from firebase_admin import credentials, firestore
import os
import boto3
from datetime import datetime, timedelta

# Variabel ENV
S3_BUCKET = os.environ.get("CONFIG_BUCKET", "configfs")
S3_KEY = os.environ.get("FIREBASE_CRED_KEY", "firebase-service-account.json")
LOCAL_CRED_PATH = "/tmp/firebase-service-account.json"

# Inisialisasi Firestore
def init_firestore():
    if not os.path.exists(LOCAL_CRED_PATH):
        print(f"Downloading Firebase credentials from s3://{S3_BUCKET}/{S3_KEY}")
        s3 = boto3.client("s3")
        s3.download_file(S3_BUCKET, S3_KEY, LOCAL_CRED_PATH)

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = LOCAL_CRED_PATH

    if not firebase_admin._apps:
        cred = credentials.Certificate(LOCAL_CRED_PATH)
        firebase_admin.initialize_app(cred)

    return firestore.client()

# Inisialisasi global
db = init_firestore()

# Cari dokumen Firestore dengan timestamp terdekat ke HH:00
def get_nearest_doc(sensor_id, target_time):
    collection = db.collection(f"current_data/{sensor_id}/main")

    closest_doc = None
    closest_diff = timedelta.max
    selected_ts_str = None

    # Coba range ±30 menit (61 titik pencarian: -30 hingga +30)
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

# Ambil 72 jam data historis dengan toleransi waktu fleksibel ±30 menit
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

# Simpan hasil prediksi ke Firestore
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