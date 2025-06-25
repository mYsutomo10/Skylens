import boto3
import os
import shutil
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from keras.layers import TFSMLayer
from datetime import datetime

S3_BUCKET = "lstm-model-skylens"
s3 = boto3.client("s3")

def download_model_from_s3(sensor_id):
    prefix = f"{sensor_id}/"
    local_dir = f"/tmp/{sensor_id}/"

    # Clean existing local directory
    if os.path.exists(local_dir):
        shutil.rmtree(local_dir)
    os.makedirs(local_dir, exist_ok=True)

    # Download model files from S3
    response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
    if "Contents" not in response:
        raise FileNotFoundError(f"No model found in S3 for {sensor_id}")

    for obj in response["Contents"]:
        key = obj["Key"]
        if key.endswith("/"):
            continue  # Skip folders
        rel_path = key[len(prefix):]
        local_path = os.path.join(local_dir, rel_path)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        print(f"Downloading {key} to {local_path}")
        s3.download_file(S3_BUCKET, key, local_path)

    return local_dir

def load_model(sensor_id):
    model_path = download_model_from_s3(sensor_id)
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

    download_model_from_s3(sensor_id)

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