import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score

def parse_date(date_str):
    if not isinstance(date_str, str) or not date_str.strip():
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None

def is_real_failure(row):
    # 1. Critical/Major priority
    priority = str(row.get('Priority', '')).lower()
    is_high_priority = any(p in priority for p in ('critical', 'urgent', 'sev1', 'major', 'sev2'))
    if is_high_priority:
        return True
        
    # 2. Check status (if open, it is unresolved, hence real failure)
    status = str(row.get('Status', '')).lower()
    is_open = not any(s in status for s in ('closed', 'resolved', 'done'))
    if is_open:
        return True
        
    # 3. Check duration (took > 30 minutes to resolve)
    opened_t = parse_date(row.get('Opened Time', ''))
    closed_t = parse_date(row.get('Closed Time', ''))
    if opened_t and closed_t:
        duration_m = (closed_t - opened_t).total_seconds() / 60.0
        if duration_m > 30.0:
            return True
            
    return False

def extract_features(df, t_obs, asset_col, date_col):
    # Filter tickets up to t_obs
    hist_df = df[df['parsed_date'] <= t_obs].copy()
    
    features = []
    
    # Group by asset
    for asset, group in hist_df.groupby(asset_col):
        group = group.sort_values(by='parsed_date')
        
        # Define windows
        three_days_ago = t_obs - timedelta(days=3)
        seven_days_ago = t_obs - timedelta(days=7)
        thirty_days_ago = t_obs - timedelta(days=30)
        
        freq3d = len(group[group['parsed_date'] >= three_days_ago])
        freq7d = len(group[group['parsed_date'] >= seven_days_ago])
        freq30d = len(group[group['parsed_date'] >= thirty_days_ago])
        
        # Recent critical tickets
        critical_group = group[group['parsed_date'] >= thirty_days_ago]
        recent_critical = len(critical_group[
            critical_group['Priority'].str.lower().str.contains('critical|urgent|sev1', na=False)
        ])
        
        # Days since last failure
        last_date = group['parsed_date'].iloc[-1]
        days_since_last = (t_obs - last_date).total_seconds() / (24 * 3600)
        
        # Auto-close rate (<5m)
        closed_tickets = group[group['Status'].str.lower().str.contains('closed|resolved|done', na=False)]
        auto_closed = 0
        for _, row in closed_tickets.iterrows():
            opened_t = row['parsed_date']
            closed_t = parse_date(row.get('Closed Time', ''))
            if opened_t and closed_t:
                duration_m = (closed_t - opened_t).total_seconds() / 60
                if 0 <= duration_m <= 5:
                    auto_closed += 1
                    
        auto_close_rate = (auto_closed / len(closed_tickets) * 100) if len(closed_tickets) > 0 else 0
        
        features.append({
            'asset': asset,
            'freq3d': freq3d,
            'freq7d': freq7d,
            'freq30d': freq30d,
            'recentCriticalCount': recent_critical,
            'daysSinceLast': days_since_last,
            'autoCloseRate': auto_close_rate
        })
        
    return pd.DataFrame(features)

def main():
    csv_file = 'main.csv'
    if not os.path.exists(csv_file):
        print(f"Error: {csv_file} not found in current directory.")
        return
        
    print("Loading data and parsing timestamps...")
    df = pd.read_csv(csv_file)
    
    # Automatically resolve date and asset columns
    date_col = next((c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()), None)
    asset_col = next((
        c for c in df.columns 
        if any(p in c.lower() for p in ('asset', 'panel', 'device', 'equipment'))
        and not any(x in c.lower() for x in ('type', 'model', 'category', 'group', 'class', 'status'))
    ), None)
    
    if not date_col or not asset_col:
        print("Error: Could not automatically detect date or asset columns.")
        return
        
    df['parsed_date'] = df[date_col].apply(parse_date)
    df = df.dropna(subset=['parsed_date'])
    
    t_max = df['parsed_date'].max()
    print(f"Dataset date range: {df['parsed_date'].min()} to {t_max}")
    print(f"Total ticket records: {len(df)}")
    
    # ==========================================
    # 1. GENERATE TRAINING & TESTING DATA (TEMPORAL SPLIT)
    # ==========================================
    print("\nGenerating training & testing data from historical observation slices (Temporal Split)...")
    train_slices = []
    test_slices = []
    
    # Slices at 14, 28, and 42 days offset
    # Offset 14 is the most recent period (Test set)
    # Offsets 28 and 42 are the older periods (Train set)
    for offset in [14, 28, 42]:
        t_obs = t_max - timedelta(days=offset)
        
        # Extract features prior to t_obs
        obs_features = extract_features(df, t_obs, asset_col, date_col)
        if obs_features.empty:
            continue
            
        # Target labels: did the asset fail in the 14 days following t_obs?
        # Only counting REAL failures (Critical/Major priority or took > 30 mins to resolve)
        t_limit = t_obs + timedelta(days=14)
        future_tickets = df[(df['parsed_date'] > t_obs) & (df['parsed_date'] <= t_limit)]
        
        real_failures = set()
        for _, row in future_tickets.iterrows():
            if is_real_failure(row):
                asset = row[asset_col]
                if pd.notna(asset):
                    real_failures.add(asset)
                    
        obs_features['label'] = obs_features['asset'].apply(lambda x: 1 if x in real_failures else 0)
        
        if offset == 14:
            test_slices.append(obs_features)
        else:
            train_slices.append(obs_features)
            
    if not train_slices or not test_slices:
        print("Error: Not enough data points to generate train/test splits.")
        return
        
    train_df = pd.concat(train_slices, ignore_index=True)
    test_df = pd.concat(test_slices, ignore_index=True)
    
    print(f"Train dataset size (Offsets 28 & 42): {len(train_df)} samples")
    print(f"Train class distribution: Failures={len(train_df[train_df['label'] == 1])}, Non-Failures={len(train_df[train_df['label'] == 0])}")
    print(f"Test dataset size (Offset 14): {len(test_df)} samples")
    print(f"Test class distribution: Failures={len(test_df[test_df['label'] == 1])}, Non-Failures={len(test_df[test_df['label'] == 0])}")
    
    feature_cols = ['freq3d', 'freq7d', 'daysSinceLast', 'autoCloseRate', 'recentCriticalCount']
    X_train = train_df[feature_cols]
    y_train = train_df['label']
    X_test = test_df[feature_cols]
    y_test = test_df['label']
    
    # ==========================================
    # 2. TRAIN MACHINE LEARNING MODEL
    # ==========================================
    print("\nTraining Random Forest Classifier (with balanced class weights)...")
    model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, class_weight='balanced')
    model.fit(X_train, y_train)
    
    # ==========================================
    # 3. MODEL EVALUATION
    # ==========================================
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    print("\n" + "="*50)
    print("MODEL PERFORMANCE METRICS (TEMPORAL EVALUATION)")
    print("="*50)
    print(f"Overall Accuracy: {accuracy_score(y_test, y_pred):.2%}")
    try:
        auc = roc_auc_score(y_test, y_prob)
        print(f"Area Under ROC Curve (ROC-AUC): {auc:.4f}")
    except ValueError:
        pass
        
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["No Failure", "Failure"]))
    
    print("\nFeature Importances:")
    importances = model.feature_importances_
    for col, imp in sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True):
        print(f"  - {col:<22}: {imp:.2%}")
    print("="*50)
    
    # ==========================================
    # 4. CURRENT STATE RISK PREDICTIONS
    # ==========================================
    print("\nCalculating current active risks for all panels (relative to t_max)...")
    current_df = extract_features(df, t_max, asset_col, date_col)
    if not current_df.empty:
        current_X = current_df[feature_cols]
        current_df['probability'] = model.predict_proba(current_X)[:, 1]
        
        top_risk = current_df.sort_values(by='probability', ascending=False).head(10)
        
        # Calculate recent real failures (7d) for current active risks
        seven_days_ago = t_max - timedelta(days=7)
        recent_real_failures = df[(df['parsed_date'] >= seven_days_ago)]
        real_failure_counts = {}
        for _, row in recent_real_failures.iterrows():
            if is_real_failure(row):
                asset = row[asset_col]
                if pd.notna(asset):
                    real_failure_counts[asset] = real_failure_counts.get(asset, 0) + 1
                    
        print("\nTOP 10 PANEL FAILURE RISK SCORES (NEXT 14 DAYS):")
        print("-"*85)
        print(f"{'Asset/Panel Name':<25} | {'Failure Probability (%)':<25} | {'Recent (7d) Real Failures':<25}")
        print("-"*85)
        for _, row in top_risk.iterrows():
            real_fail_cnt = real_failure_counts.get(row['asset'], 0)
            print(f"{row['asset']:<25} | {row['probability']:.2%} | {real_fail_cnt:<25}")
        print("-"*85)

if __name__ == '__main__':
    main()
