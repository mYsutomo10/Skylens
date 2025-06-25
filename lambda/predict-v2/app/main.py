import json
from model_handler import predict
from firestore_handler import fetch_sensor_data, save_forecast
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

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

def lambda_handler(event, context):
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