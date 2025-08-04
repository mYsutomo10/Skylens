import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import os
from flask import Flask, request, jsonify

# Impor dari file-file handler
from model_handler import predict
from firestore_handler import fetch_sensor_data, save_forecast, init_firestore

# Inisialisasi aplikasi Flask
app = Flask(__name__)

# Fungsi untuk memuat kredensial Firestore
def load_firestore_credentials():
    try:
        init_firestore()
    except Exception as e:
        print(f"Failed to initialize Firestore: {e}")
        pass

# Panggil saat aplikasi startup
with app.app_context():
    load_firestore_credentials()

# Logika handler utama (mirip dengan main.py)
def process_sensor(sensor_id, timestamp_str):
    print(f"Processing {sensor_id} for {timestamp_str}")
    try:
        timestamp = datetime.strptime(timestamp_str, "%Y%m%dT%H%M")
        raw_data = fetch_sensor_data(sensor_id, timestamp)
        if not raw_data or len(raw_data) < 72:
            return sensor_id, f"Skipped (only {len(raw_data)} records)"

        prediction, location = predict(sensor_id, raw_data)
        save_forecast(sensor_id, timestamp, prediction, location)
        return sensor_id, "Prediction saved"
    except Exception as e:
        return sensor_id, f"Failed: {str(e)}"

def handler_logic(event):
    sensor_ids = event.get("sensorId")
    if isinstance(sensor_ids, str):
        sensor_ids = [sensor_ids]
    elif not isinstance(sensor_ids, list):
        return {
            "statusCode": 400,
            "body": json.dumps("Invalid sensorId format. Expected list or string.")
        }

    timestamp_str = event.get('timestamp')
    if not timestamp_str:
        timestamp_str = datetime.now().strftime("%Y%m%dT%H%M")

    results = {}

    with ThreadPoolExecutor(max_workers=min(4, len(sensor_ids))) as executor:
        futures = {executor.submit(process_sensor, sid, timestamp_str): sid for sid in sensor_ids}
        for future in futures:
            sensor_id, result = future.result()
            results[sensor_id] = result

    return {
        "statusCode": 200,
        "body": json.dumps(results)
    }

# Endpoint Flask
@app.route("/", methods=["POST"])
def run_handler():
    try:
        event = request.get_json()
        if not event:
            return jsonify({"error": "No JSON payload provided."}), 400

        response = handler_logic(event)
        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))