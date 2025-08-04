import os
import shutil
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from keras.layers import TFSMLayer
from datetime import datetime
from google.cloud import storage

# Variabel ENV
GCS_BUCKET = os.environ.get("MODEL_BUCKET", "lstm-model-skylens")

def download_model_from_gcs(sensor_id):
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET)
    prefix = f"{sensor_id}/"
    local_dir = f"/tmp/{sensor_id}/"

    if os.path.exists(local_dir):
        shutil.rmtree(local_dir)
    os.makedirs(local_dir, exist_ok=True)

    blobs = bucket.list_blobs(prefix=prefix)
    downloaded = False
    for blob in blobs:
        if blob.name.endswith("/"):
            continue
        rel_path = blob.name[len(prefix):]
        local_path = os.path.join(local_dir, rel_path)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        print(f"Downloading {blob.name} to {local_path}")
        blob.download_to_filename(local_path)
        downloaded = True

    if not downloaded:
        raise FileNotFoundError(f"No model found in GCS for {sensor_id}")

    return local_dir

def load_model(sensor_id):
    model_path = download_model_from_gcs(sensor_id)
    tfsmlayer = TFSMLayer(model_path, call_endpoint="serving_default")
    return tf.keras.Sequential([tfsmlayer])

def load_scalers(sensor_id):
    base_path = f"/tmp/{sensor_id}/"
    scaler_x = joblib.load(os.path.join(base_path, "scaler_x.pkl"))
    scaler_y = joblib.load(os.path.join(base_path, "scaler_y.pkl"))
    return scaler_x, scaler_y

def normalize_firestore_data(raw_data):
    rows = []

    for doc in raw_data:
        try:
            row = {
                "dt": datetime.strptime(doc["timestamp"], "%Y%m%dT%H%M"),
                "pm2_5": doc["components"]["pm2_5"],
                "pm10": doc["components"]["pm10"],
                "co": doc["components"]["co"],
                "nh3": doc["components"]["nh3"],
                "o3": doc["components"]["o3"],
                "no2": doc["components"]["no2"],
                "temp": doc["meteo"]["temp"],
                "rhum": doc["meteo"]["rhum"],
                "log_prcp": doc["meteo"]["log_prcp"],
                "wdir_sin": doc["meteo"]["wdir_sin"],
                "wdir_cos": doc["meteo"]["wdir_cos"],
                "wspd": doc["meteo"]["wspd"],
                "aqi": doc["aqi"],
                "location": doc["location"],
            }
            rows.append(row)
        except KeyError as e:
            print(f"Skipping row due to missing key: {e}")

    df = pd.DataFrame(rows)
    df.set_index("dt", inplace=True)

    df["hour"] = df.index.hour
    df["dayofweek"] = df.index.dayofweek
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["dayofweek"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["dayofweek"] / 7)
    df.drop(columns=["hour", "dayofweek"], inplace=True)

    for i in range(1, 6):
        df[f"aqi_lag{i}"] = df["aqi"].shift(i)

    df.dropna(inplace=True)
    return df

def prepare_input(df, scaler_x):
    feature_columns = [
        "pm2_5", "pm10", "co", "nh3", "o3", "no2",
        "temp", "rhum", "log_prcp", "wdir_sin", "wdir_cos", "wspd",
        "hour_sin", "hour_cos", "dow_sin", "dow_cos",
        "aqi_lag1", "aqi_lag2", "aqi_lag3", "aqi_lag4", "aqi_lag5"
    ]

    X = df[feature_columns].values
    X_scaled = scaler_x.transform(X)
    return X_scaled.reshape(1, 72, -1)

def predict(sensor_id, raw_data):
    df = normalize_firestore_data(raw_data)

    if len(df) < 72:
        raise ValueError(f"Sensor {sensor_id} has insufficient data: got {len(df)}.")

    download_model_from_gcs(sensor_id)

    model = load_model(sensor_id)
    scaler_x, scaler_y = load_scalers(sensor_id)
    X_input = prepare_input(df, scaler_x)

    raw_output = model(X_input, training=False)

    y_pred_scaled = list(raw_output.values())[0].numpy()
    y_pred = scaler_y.inverse_transform(y_pred_scaled)

    last = df.iloc[-1]
    location = {
        "lat": last["location"]["lat"],
        "lon": last["location"]["lon"],
        "name": last["location"]["name"]
    }

    return y_pred.flatten().tolist(), location