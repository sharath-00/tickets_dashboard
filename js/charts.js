/* ==========================================================
SMART LIGHT TICKET MONITORING SYSTEM
Chart Engine
========================================================== */

Chart.defaults.color = "#CBD5E1";
Chart.defaults.borderColor = "#233548";
Chart.defaults.font.family = "Inter";

/* ==========================================================
RENDER ALL CHARTS
========================================================== */

function renderCharts(){

    trendStartIndex = -1;

    destroyCharts();

    createTicketTrend();

    createPriorityChart();

    createStatusChart();

    createProblemChart();

    createRegionChart();

    createZoneChart();

    createWardChart();

    createResolutionChart();

    createDeviceChart();

    createCommunicationChart();

    createFaultDistributionChart();

    createAgingChart();

}

/* ==========================================================
DESTROY OLD CHARTS
========================================================== */

function destroyCharts(){

    Object.values(charts).forEach(chart=>{

        if(chart){

            chart.destroy();

        }

    });

    charts = {};

}

function renderChart(id, config){

    const canvas = document.getElementById(id);

    if(!canvas) return;

    charts[id] = new Chart(canvas, config);

}

function getTicketValue(ticket, possibleKeys){

    for(const key of possibleKeys){

        if(ticket[key] !== undefined && ticket[key] !== null && String(ticket[key]).trim() !== ""){

            return String(ticket[key]);

        }

    }

    return "";

}

function normalizeText(value){

    return String(value || "").toLowerCase().trim();

}

function getFieldCounts(records, possibleKeys, fallbackLabel = "Unspecified"){

    const counts = new Map();

    records.forEach(ticket=>{

        const value = getTicketValue(ticket, possibleKeys);

        const label = value ? value : fallbackLabel;

        counts.set(label, (counts.get(label)||0)+1);

    });

    return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]);

}

function getTopBuckets(records, possibleKeys, limit = 5){

    const counts = getFieldCounts(records, possibleKeys);

    if(counts.length <= limit){

        return counts;

    }

    const top = counts.slice(0, limit);

    const restValue = counts.slice(limit).reduce((sum, [,count])=>sum+count,0);

    if(restValue > 0){

        top.push(["Other", restValue]);

    }

    return top;

}

/* ==========================================================
TICKET TREND
========================================================== */

let trendStartIndex = -1;
let trendSortedKeys = [];
let trendBuckets = new Map();

function createTicketTrend(){
    trendBuckets.clear();

    FILTERED_DATA.forEach(ticket=>{
        const rawDate = getTicketValue(ticket,["Opened Time","Opened","Created Time","Created","Date","date","opened","created"]);
        const parsed = rawDate ? new Date(rawDate) : null;
        if(!parsed || Number.isNaN(parsed.getTime())) return;
        const key = parsed.toISOString().slice(0,10);
        trendBuckets.set(key, (trendBuckets.get(key)||0)+1);
    });

    trendSortedKeys = Array.from(trendBuckets.keys()).sort();

    // Reset start index to the last 7 days of the sorted keys on initialization
    if (trendStartIndex === -1) {
        trendStartIndex = Math.max(0, trendSortedKeys.length - 7);
    }

    renderTrendWindowChart();
    setupTrendNavControls();
}

function renderTrendWindowChart() {
    const labels = trendSortedKeys.slice(trendStartIndex, trendStartIndex + 7);
    const data = labels.map(key => trendBuckets.get(key) || 0);

    const formattedLabels = labels.length 
        ? labels.map(key => new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
        : ["No data"];
    const formattedData = labels.length ? data : [0];

    const chartInstance = charts["ticketTrendChart"];
    if (chartInstance) {
        chartInstance.data.labels = formattedLabels;
        chartInstance.data.datasets[0].data = formattedData;
        chartInstance.update();
    } else {
        renderChart("ticketTrendChart", {
            type: "line",
            data: {
                labels: formattedLabels,
                datasets: [{
                    label: "Tickets",
                    data: formattedData,
                    borderColor: "#F5A524",
                    backgroundColor: "rgba(245,165,36,.15)",
                    fill: true,
                    tension: .4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    updateTrendUI(labels);
}

function updateTrendUI(labels) {
    const rangeSpan = document.getElementById("trendDateRange");
    if (rangeSpan) {
        if (labels.length > 0) {
            const startStr = new Date(labels[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const endStr = new Date(labels[labels.length - 1]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            rangeSpan.textContent = `${startStr} - ${endStr}`;
        } else {
            rangeSpan.textContent = "No data available";
        }
    }

    const prevBtn = document.getElementById("prevTrendBtn");
    const nextBtn = document.getElementById("nextTrendBtn");

    if (prevBtn) {
        prevBtn.disabled = (trendStartIndex <= 0);
    }
    if (nextBtn) {
        nextBtn.disabled = (trendStartIndex >= trendSortedKeys.length - 7);
    }
}

function setupTrendNavControls() {
    const prevBtn = document.getElementById("prevTrendBtn");
    const nextBtn = document.getElementById("nextTrendBtn");

    if (prevBtn && !prevBtn.dataset.listenerBound) {
        prevBtn.addEventListener("click", () => {
            trendStartIndex = Math.max(0, trendStartIndex - 7);
            renderTrendWindowChart();
        });
        prevBtn.dataset.listenerBound = "true";
    }

    if (nextBtn && !nextBtn.dataset.listenerBound) {
        nextBtn.addEventListener("click", () => {
            trendStartIndex = Math.min(Math.max(0, trendSortedKeys.length - 7), trendStartIndex + 7);
            renderTrendWindowChart();
        });
        nextBtn.dataset.listenerBound = "true";
    }
}

/* ==========================================================
PRIORITY
========================================================== */

function createPriorityChart(){

    const counts = {Critical:0, Major:0, Minor:0, Low:0};

    FILTERED_DATA.forEach(ticket=>{

        const priority = normalizeText(getTicketValue(ticket,["Priority","priority"]));

        if(priority.includes("critical") || priority.includes("urgent") || priority.includes("sev1")){

            counts.Critical++;

        }
        else if(priority.includes("major") || priority.includes("high") || priority.includes("sev2")){

            counts.Major++;

        }
        else if(priority.includes("minor") || priority.includes("medium") || priority.includes("sev3")){

            counts.Minor++;

        }
        else{

            counts.Low++;

        }

    });

    renderChart("priorityChart",{

        type:"doughnut",

        data:{

            labels:["Critical", "Major", "Minor", "Low"],

            datasets:[{

                data:[counts.Critical, counts.Major, counts.Minor, counts.Low],

                backgroundColor:["#EF4444", "#F97316", "#F5A524", "#22C55E"]

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{position:"bottom"}}

        }

    });

}

/* ==========================================================
STATUS
========================================================== */

function createStatusChart(){

    let open = 0;

    let closed = 0;

    FILTERED_DATA.forEach(ticket=>{

        const status = normalizeText(getTicketValue(ticket,["Status","status"]));

        if(status.includes("closed") || status.includes("resolved") || status.includes("done")){

            closed++;

        }
        else{

            open++;

        }

    });

    renderChart("statusChart",{

        type:"doughnut",

        data:{

            labels:["Open", "Closed"],

            datasets:[{

                data:[open, closed],

                backgroundColor:["#F97316", "#22C55E"]

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{position:"bottom"}}

        }

    });

}
/* ==========================================================
PROBLEM TYPES
========================================================== */

function createProblemChart(){

    const buckets = getTopBuckets(FILTERED_DATA,["Problem Type","Problem","Fault Type","Issue Type"],5);

    renderChart("problemChart",{

        type:"bar",

        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#4AA8FF"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            indexAxis:"y",

            plugins:{

                legend:{

                    display:false

                }

            }

        }

    });

}

/* ==========================================================
REGION
========================================================== */

function createRegionChart(){

    // Filter RAW_DATA by applying status, priority, and search filters, but ignoring region/zone/ward location filters.
    const regionComparisonData = RAW_DATA.filter(ticket => {
        return (
            matches(ticket, findColumn(["Priority","priority"]), filterIds.priority)
            && matchesMultiSelectStatus(ticket)
            && matchesMultiSelectTicketState(ticket)
            && searchMatch(ticket)
        );
    });

    const buckets = getFieldCounts(regionComparisonData,["Region","region"]);

    renderChart("regionChart",{

        type:"bar",

        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#8B5CF6"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{

                    display:false

                }

            }

        }

    });

}
/* ==========================================================
ZONE
========================================================== */

function createZoneChart(){

    const buckets = getFieldCounts(FILTERED_DATA,["Zone","zone"]);

    renderChart("zoneChart",{

        type:"bar",

        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#06B6D4"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{display:false}}

        }

    });

}

/* ==========================================================
WARD
========================================================== */

function createWardChart(){

    const buckets = getFieldCounts(FILTERED_DATA,["Ward","ward"]);

    renderChart("wardChart",{

        type:"bar",
        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#22C55E"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{display:false}}

        }

    });

}

/* ==========================================================
RESOLUTION
========================================================== */

function createResolutionChart(){

    const bins = [0,0,0,0];

    FILTERED_DATA.forEach(ticket=>{

        const hours = calculateResolution(ticket);

        if(hours <= 4){

            bins[0]++;

        }
        else if(hours <= 8){

            bins[1]++;

        }
        else if(hours <= 24){

            bins[2]++;

        }
        else{

            bins[3]++;

        }

    });

    renderChart("resolutionChart",{

        type:"bar",

        data:{

            labels:["0-4 hrs", "4-8 hrs", "8-24 hrs", "24+ hrs"],

            datasets:[{

                data:bins,

                backgroundColor:"#F97316"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{display:false}}

        }

    });

}

/* ==========================================================
DEVICE
========================================================== */

function createDeviceChart(){

    const buckets = getFieldCounts(FILTERED_DATA,["Device Type","Device","Equipment","Asset"],"Unknown");

    renderChart("deviceChart",{

        type:"bar",
        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#4AA8FF"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{display:false}}

        }

    });

}

/* ==========================================================
COMMUNICATION
========================================================== */

function createCommunicationChart(){

    const buckets = getFieldCounts(FILTERED_DATA,["Communication","Communication Status","Connectivity","Connection"],"Unknown");

    renderChart("communicationChart",{

        type:"bar",
        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#8B5CF6"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{display:false}}

        }

    });

}

/* ==========================================================
FAULT DISTRIBUTION
========================================================== */

function createFaultDistributionChart(){

    const buckets = getTopBuckets(FILTERED_DATA,["Fault Type","Fault","Problem Type","Problem"],5);

    renderChart("faultDistributionChart",{

        type:"bar",
        data:{

            labels:buckets.map(([label])=>label),

            datasets:[{

                data:buckets.map(([,count])=>count),

                backgroundColor:"#EF4444"

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{legend:{display:false}}

        }

    });

}

/* ==========================================================
OPEN TICKET AGING CHART
========================================================== */

function createAgingChart() {
    const bins = [0, 0, 0, 0]; // 0-3d, 3-7d, 7-14d, 14d+

    FILTERED_DATA.forEach(ticket => {
        const status = normalizeText(getTicketValue(ticket, ["Status", "status"]));
        const isOpen = !status.includes("closed") && !status.includes("resolved") && !status.includes("done");
        if (!isOpen) return;

        let ageDays = parseFloat(getTicketValue(ticket, ["Duration (Days)", "duration"])) || 0.0;
        if (ageDays === 0) {
            const rawDate = getTicketValue(ticket, ["Opened Time", "Opened", "Created Time", "Created", "Date"]);
            const parsed = rawDate ? new Date(rawDate) : null;
            if (parsed && !isNaN(parsed.getTime())) {
                const now = new Date();
                ageDays = (now - parsed) / (1000 * 60 * 60 * 24);
            }
        }

        if (ageDays <= 3) {
            bins[0]++;
        } else if (ageDays <= 7) {
            bins[1]++;
        } else if (ageDays <= 14) {
            bins[2]++;
        } else {
            bins[3]++;
        }
    });

    renderChart("agingChart", {
        type: "bar",
        data: {
            labels: ["0-3 days", "3-7 days", "7-14 days", "14+ days"],
            datasets: [{
                data: bins,
                backgroundColor: "#EC4899"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    grid: { color: "#233548" },
                    ticks: { precision: 0 }
                }
            }
        }
    });
}