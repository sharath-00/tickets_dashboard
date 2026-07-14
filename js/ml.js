/* ==========================================================
CLIENT-SIDE MACHINE LEARNING PREDICTIVE MAINTENANCE ENGINE
Random Forest Classifier in pure JavaScript
========================================================== */

/**
 * Calculates Gini Impurity for binary targets (0 or 1)
 */
function calculateGini(targets) {
    if (targets.length === 0) return 0;
    const sum = targets.reduce((a, b) => a + b, 0);
    const p1 = sum / targets.length;
    const p0 = 1 - p1;
    return 1 - (p0 * p0 + p1 * p1);
}

/**
 * Recursive CART Decision Tree induction
 */
function trainDecisionTree(data, features, target, depth = 0, maxDepth = 4) {
    const targets = data.map(d => d[target]);
    const uniqueTargets = [...new Set(targets)];

    // If perfectly clean node
    if (uniqueTargets.length === 1) {
        return { isLeaf: true, value: uniqueTargets[0] };
    }

    // Stop splitting if constraints hit
    if (depth >= maxDepth || data.length < 5) {
        const sum = targets.reduce((a, b) => a + b, 0);
        return { isLeaf: true, value: sum / data.length };
    }

    let bestFeature = null;
    let bestThreshold = null;
    let bestGini = 1.0;
    let bestLeft = [];
    let bestRight = [];

    features.forEach(feature => {
        const values = [...new Set(data.map(d => d[feature]))].sort((a, b) => a - b);
        for (let i = 0; i < values.length - 1; i++) {
            const threshold = (values[i] + values[i + 1]) / 2;
            const left = data.filter(d => d[feature] <= threshold);
            const right = data.filter(d => d[feature] > threshold);

            if (left.length === 0 || right.length === 0) continue;

            const giniLeft = calculateGini(left.map(d => d[target]));
            const giniRight = calculateGini(right.map(d => d[target]));
            const weightedGini = (left.length * giniLeft + right.length * giniRight) / data.length;

            if (weightedGini < bestGini) {
                bestGini = weightedGini;
                bestFeature = feature;
                bestThreshold = threshold;
                bestLeft = left;
                bestRight = right;
            }
        }
    });

    if (bestFeature === null) {
        const sum = targets.reduce((a, b) => a + b, 0);
        return { isLeaf: true, value: sum / data.length };
    }

    return {
        isLeaf: false,
        feature: bestFeature,
        threshold: bestThreshold,
        left: trainDecisionTree(bestLeft, features, target, depth + 1, maxDepth),
        right: trainDecisionTree(bestRight, features, target, depth + 1, maxDepth)
    };
}

/**
 * Predict with a single Decision Tree
 */
function predictTree(node, sample) {
    if (node.isLeaf) {
        return node.value;
    }
    if (sample[node.feature] <= node.threshold) {
        return predictTree(node.left, sample);
    } else {
        return predictTree(node.right, sample);
    }
}

/**
 * Train a Random Forest (Ensemble of Decision Trees with bagging)
 */
function trainRandomForest(data, features, target, numTrees = 5, maxDepth = 3) {
    const forest = [];
    for (let t = 0; t < numTrees; t++) {
        // Bootstrap sample (sampling with replacement)
        const bootstrapSample = [];
        for (let i = 0; i < data.length; i++) {
            const idx = Math.floor(Math.random() * data.length);
            bootstrapSample.push(data[idx]);
        }

        // Feature bagging (choose subset of features)
        const shuffledFeatures = [...features].sort(() => 0.5 - Math.random());
        const subsampledFeatures = shuffledFeatures.slice(0, Math.ceil(features.length * 0.8));

        const tree = trainDecisionTree(bootstrapSample, subsampledFeatures, target, 0, maxDepth);
        forest.push(tree);
    }
    return forest;
}

/**
 * Predict probability using Random Forest ensemble average
 */
function predictForest(forest, sample) {
    let sum = 0;
    forest.forEach(tree => {
        sum += predictTree(tree, sample);
    });
    return sum / forest.length;
}

/**
 * Determines if a ticket represents a real failure (not flapping noise)
 */
function isRealFailure(ticket) {
    const priority = (ticket.Priority || ticket.priority || "").toLowerCase();
    const isHighPriority = priority.includes("critical") || 
                           priority.includes("urgent") || 
                           priority.includes("sev1") || 
                           priority.includes("major") || 
                           priority.includes("sev2");
                           
    const status = (ticket.Status || ticket.status || "").toLowerCase();
    const isOpen = !status.includes("closed") && !status.includes("resolved") && !status.includes("done");
    
    if (isHighPriority) return true;
    if (isOpen) return true;
    
    // Fallback: calculate resolution time in hours
    const opened = ticket["Opened Time"] || ticket.OpenedTime || ticket.opened;
    const closed = ticket["Closed Time"] || ticket.ClosedTime || ticket.closed;
    if (!opened || !closed) return false;
    const start = new Date(opened);
    const end = new Date(closed);
    if (isNaN(start) || isNaN(end)) return false;
    const resHrs = (end - start) / 1000 / 60 / 60;
    
    return (resHrs * 60 > 30);
}

/**
 * Extract ML features for a set of panels at a specific observation point (tObs)
 */
function extractFeaturesForObservation(records, tObs, assetColumn, dateColumn) {
    const panelsMap = new Map();

    // 1. Group records by panel up to tObs
    records.forEach(row => {
        const asset = getColumnValue(row, assetColumn) || getTicketValue(row, ASSET_COLUMN_NAMES);
        if (!asset) return;

        const date = parseTicketDate(row, dateColumn);
        if (!date || date.getTime() > tObs.getTime()) return;

        if (!panelsMap.has(asset)) {
            panelsMap.set(asset, []);
        }
        panelsMap.get(asset).push({ row, date });
    });

    const featuresList = [];

    panelsMap.forEach((tickets, asset) => {
        // Sort by opened date
        tickets.sort((a, b) => a.date - b.date);

        // Feature calculations
        const threeDaysAgo = tObs.getTime() - 3 * 24 * 60 * 60 * 1000;
        const sevenDaysAgo = tObs.getTime() - 7 * 24 * 60 * 60 * 1000;
        const thirtyDaysAgo = tObs.getTime() - 30 * 24 * 60 * 60 * 1000;

        const freq3d = tickets.filter(t => t.date.getTime() >= threeDaysAgo).length;
        const freq7d = tickets.filter(t => t.date.getTime() >= sevenDaysAgo).length;
        const freq30d = tickets.filter(t => t.date.getTime() >= thirtyDaysAgo).length;

        // Recent Critical Alerts Count
        const recentCriticalCount = tickets.filter(t => {
            if (t.date.getTime() < thirtyDaysAgo) return false;
            const priority = (t.row.Priority || t.row.priority || "").toLowerCase();
            return priority.includes("critical") || priority.includes("urgent") || priority.includes("sev1");
        }).length;

        // Days since last failure
        const lastTicket = tickets[tickets.length - 1];
        const daysSinceLast = (tObs.getTime() - lastTicket.date.getTime()) / (1000 * 60 * 60 * 24);

        // Auto-Close rate (<5m)
        let closedCount = 0;
        let autoClosedCount = 0;
        tickets.forEach(t => {
            const status = (t.row.Status || t.row.status || "").toLowerCase();
            const isClosed = status.includes("closed") || status.includes("resolved") || status.includes("done");
            if (isClosed) {
                closedCount++;
                const resHrs = calculateResolution(t.row);
                if (resHrs > 0 && (resHrs * 60) <= 5) {
                    autoClosedCount++;
                }
            }
        });
        const autoCloseRate = closedCount === 0 ? 0 : (autoClosedCount / closedCount) * 100;

        featuresList.push({
            asset,
            freq3d,
            freq7d,
            freq30d,
            recentCriticalCount,
            daysSinceLast,
            autoCloseRate
        });
    });

    return featuresList;
}

/**
 * Runs the Predictive Maintenance Model on the dataset
 */
function runPredictiveMaintenanceModel(records) {
    if (records.length === 0) return [];

    const assetColumn = detectAssetColumn(records);
    const dateColumn = detectDateColumn(records);

    if (!assetColumn || !dateColumn) return [];

    // Parse and find max date
    const parsedDates = records.map(r => parseTicketDate(r, dateColumn)).filter(Boolean);
    if (parsedDates.length === 0) return [];
    
    // Sort dates to find tMax
    parsedDates.sort((a, b) => b - a);
    const tMax = parsedDates[0];

    // ==========================================
    // 1. GENERATE TRAINING DATA VIA TIMELINE SPLITS
    // ==========================================
    const observationOffsets = [14, 28, 42]; // Split points in days before tMax
    const trainingData = [];

    observationOffsets.forEach(offsetDays => {
        const tObs = new Date(tMax.getTime() - offsetDays * 24 * 60 * 60 * 1000);
        
        // Extract features before tObs
        const featuresAtObs = extractFeaturesForObservation(records, tObs, assetColumn, dateColumn);

        // Map targets: did this asset fail in [tObs, tObs + 14d]?
        const tLimit = new Date(tObs.getTime() + 14 * 24 * 60 * 60 * 1000);
        const futureFailedAssets = new Set();
        
        records.forEach(row => {
            const date = parseTicketDate(row, dateColumn);
            if (date && date.getTime() > tObs.getTime() && date.getTime() <= tLimit.getTime()) {
                const asset = getColumnValue(row, assetColumn) || getTicketValue(row, ASSET_COLUMN_NAMES);
                if (asset && isRealFailure(row)) {
                    futureFailedAssets.add(asset);
                }
            }
        });

        featuresAtObs.forEach(sample => {
            sample.label = futureFailedAssets.has(sample.asset) ? 1 : 0;
            trainingData.push(sample);
        });
    });

    // If training set is too small to build a tree, fallback to heuristics
    const featuresList = ['freq3d', 'freq7d', 'daysSinceLast', 'autoCloseRate', 'recentCriticalCount'];
    let forest = [];
    const modelAvailable = trainingData.length >= 10 && trainingData.some(d => d.label === 1) && trainingData.some(d => d.label === 0);

    if (modelAvailable) {
        forest = trainRandomForest(trainingData, featuresList, 'label', 5, 3);
    }

    // ==========================================
    // 2. EXTRACT CURRENT FEATURES & PREDICT
    // ==========================================
    const currentFeatures = extractFeaturesForObservation(records, tMax, assetColumn, dateColumn);
    const predictions = [];

    // Calculate maximum flap rates for each device using a 24h sliding window
    const maxFlapRatesMap = new Map();
    const assetGroups = new Map();
    records.forEach(ticket => {
        const asset = getColumnValue(ticket, assetColumn) || getTicketValue(ticket, ASSET_COLUMN_NAMES);
        if (!asset) return;
        if (!assetGroups.has(asset)) assetGroups.set(asset, []);
        assetGroups.get(asset).push(ticket);
    });

    assetGroups.forEach((tickets, name) => {
        const sortedDates = tickets.map(t => parseTicketDate(t, dateColumn)).filter(Boolean).sort((a,b)=>a-b);
        let maxFlap = 0;
        for (let i = 0; i < sortedDates.length; i++) {
            let count = 1;
            const limitTime = sortedDates[i].getTime() + 24 * 60 * 60 * 1000;
            for (let j = i + 1; j < sortedDates.length; j++) {
                if (sortedDates[j].getTime() <= limitTime) count++;
                else break;
            }
            if (count > maxFlap) maxFlap = count;
        }
        maxFlapRatesMap.set(name, maxFlap);
    });

    currentFeatures.forEach(sample => {
        let prob = 0.0;
        if (modelAvailable) {
            prob = predictForest(forest, sample);
        } else {
            // Heuristic fallback if ML dataset is not diverse enough
            if (sample.freq3d > 2 || sample.freq7d > 5) {
                prob = 0.85;
            } else if (sample.freq7d > 2) {
                prob = 0.50;
            } else if (sample.daysSinceLast < 2) {
                prob = 0.35;
            } else {
                prob = 0.05;
            }
        }

        // Smooth probability slightly to avoid extreme 0% or 100% outputs in display
        if (prob > 0.95) prob = 0.95;
        if (prob < 0.05) prob = 0.05;

        // Calculate Recent Failures in last 7 days of dataset
        const sevenDaysAgo = tMax.getTime() - 7 * 24 * 60 * 60 * 1000;
        const panelTickets = assetGroups.get(sample.asset) || [];
        const recentFailuresCount = panelTickets.filter(t => {
            const date = parseTicketDate(t, dateColumn);
            return date && date.getTime() >= sevenDaysAgo && isRealFailure(t);
        }).length;

        // Determine Risk Level
        let riskLevel = "Low";
        if (prob >= 0.70) riskLevel = "High";
        else if (prob >= 0.30) riskLevel = "Medium";

        // Determine Recommendation
        let recommendation = "Routine inspection on next cycle";
        if (riskLevel === "High") {
            recommendation = "Immediate dispatch / Component replacement";
        } else if (riskLevel === "Medium") {
            recommendation = "Schedule inspection within 72 hours";
        }

        predictions.push({
            name: sample.asset,
            probability: prob,
            riskLevel,
            recentFailures: recentFailuresCount,
            daysSinceLast: sample.daysSinceLast.toFixed(1),
            flapRate: maxFlapRatesMap.get(sample.asset) || 0,
            recommendation
        });
    });

    // Sort by failure probability descending
    return predictions.sort((a, b) => b.probability - a.probability);
}
