/* ==========================================================
SMART LIGHT TICKET MONITORING SYSTEM
Main Application
========================================================== */

let RAW_DATA = [];

let FILTERED_DATA = [];

let LOADED_FILES = new Set();

let charts = {};

let filtersInitialized = false;

let currentPredictiveRiskFilter = "High";

let displayedPredictiveRiskCount = 20;

const csvInput = document.getElementById("csvFileInput");

const uploadBtn = document.getElementById("uploadBtn");

const loadingOverlay = document.getElementById("loadingOverlay");

/* ==========================================================
APPLICATION START
========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    initializeClock();

    initializeUpload();

    initializeNavigation();

    initializeActionButtons();

    initializePredictiveRiskListeners();

    loadMainCsvOnStartup();

    hideLoader();

});

/* ==========================================================
LIVE CLOCK
========================================================== */

function initializeClock(){

    updateClock();

    setInterval(updateClock,1000);

}

function updateClock(){

    const now = new Date();

    document.getElementById("clock").textContent =
        now.toLocaleTimeString();

}

/* ==========================================================
LOADER
========================================================== */

function hideLoader(){

    setTimeout(()=>{

        loadingOverlay.style.opacity="0";

        setTimeout(()=>{

            loadingOverlay.style.display="none";

        },500);

    },1000);

}

/* ==========================================================
NAVIGATION HANDLING
========================================================== */

function initializeNavigation(){

    document.querySelectorAll(".nav-btn").forEach(button=>{

        button.addEventListener("click",()=>{

            activateNavButton(button);

            const targetId = button.dataset.target;

            if(targetId){

                const target = document.getElementById(targetId);

                if(target){

                    target.scrollIntoView({behavior:"smooth", block:"start"});

                }

            }

        });

    });

}

function activateNavButton(activeButton){

    document.querySelectorAll(".nav-btn").forEach(button=>{

        button.classList.toggle("active", button === activeButton);

    });

}

/* ==========================================================
ACTION BUTTONS
========================================================== */

function initializeActionButtons(){

    document.getElementById("refreshBtn")?.addEventListener("click",()=>{

        if(RAW_DATA.length){

            initializeDashboard();

        }

    });

    document.getElementById("exportBtn")?.addEventListener("click", exportFilteredData);

    document.getElementById("resetBtn")?.addEventListener("click", resetFilters);

    document.getElementById("clearBtn")?.addEventListener("click", clearDatabase);

}

function resetFilters(){

    document.getElementById("regionFilter").value = "All";

    document.getElementById("zoneFilter").value = "All";

    document.getElementById("wardFilter").value = "All";

    document.getElementById("priorityFilter").value = "All";

    document.getElementById("ticketSearch").value = "";

    // Reset status button filters
    selectedStatuses.clear();

    document.querySelectorAll("#statusFilterButtons .filter-button").forEach(btn=>{

        btn.classList.remove("active");

        if(btn.dataset.value==="All"){

            btn.classList.add("active");

        }

    });

    // Reset ticket state button filters
    selectedTicketStates.clear();

    selectedTicketStates.add("All");

    document.querySelectorAll("#ticketStateFilterButtons .filter-button").forEach(btn=>{

        btn.classList.remove("active");

        if(btn.dataset.value==="All"){

            btn.classList.add("active");

        }

    });

    applyFilters();

}

function exportFilteredData(){

    if(!FILTERED_DATA.length){

        alert("No tickets available to export.");

        return;

    }

    const csv = Papa.unparse(FILTERED_DATA);

    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "filtered_tickets.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}

/* ==========================================================
UPLOAD BUTTON
========================================================== */

function initializeUpload(){

    uploadBtn.addEventListener("click",()=>{

        csvInput.click();

    });

    csvInput.addEventListener("change",readCSV);

}

/* ==========================================================
READ CSV
========================================================== */

function readCSV(event){

    const files = event.target.files;

    if(!files || files.length === 0) return;

    let parsedRows = [];
    let filesParsedCount = 0;
    
    showToast(`Parsing ${files.length} CSV file(s)...`, "info");

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        LOADED_FILES.add(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(result) {
                const normalized = normalizeCsvRows(result.data);
                
                // Standardize keys so they match our database schema columns
                const standardized = normalized.map(standardizeTicket);
                parsedRows = parsedRows.concat(standardized);
                filesParsedCount++;

                if (filesParsedCount === files.length) {
                    uploadTicketsToServer(parsedRows);
                    
                    // Reset file input value so the same file can be uploaded again if needed
                    csvInput.value = "";
                }
            }
        });
    }

}

function normalizeCsvRows(rows){

    return rows.map(row=>{

        const normalized={};

        Object.entries(row).forEach(([key,value])=>{

            normalized[String(key).replace(/^\uFEFF/,"").trim()]=value;

        });

        return normalized;

    });

}
/* ==========================================================
INITIALIZE DASHBOARD
========================================================== */

function initializeDashboard(){

    currentPage = 1;

    calculateKPIs();

    loadFilters();

    renderCharts();

    populateTable();

    updateCriticalAlerts();

    renderChronicTickets();

    renderNoisyDevices();

    renderPredictiveRisk();

}

/* ==========================================================
CRITICAL ALERTS
========================================================== */

function updateCriticalAlerts(){

    const container=document.querySelector(".critical-list");

    if(!container) return;

    if(!FILTERED_DATA.length){

        container.innerHTML=`
            <div class="critical-item">
                <div class="critical-left">
                    <span class="critical-priority critical">Critical</span>
                    <div>
                        <h4>Ticket #---</h4>
                        <p>Upload a CSV file to see real alerts.</p>
                    </div>
                </div>
                <span class="critical-age">-- hrs</span>
            </div>
        `;

        return;

    }

    const criticalTickets=[...FILTERED_DATA]

        .filter(ticket=>{

            const priority = normalizeText(getTicketValue(ticket,["Priority","priority"]));

            return priority.includes("critical") || priority.includes("urgent") || priority.includes("sev1");

        })

        .sort((a,b)=>calculateResolution(b)-calculateResolution(a))

        .slice(0,3);

    if(!criticalTickets.length){

        container.innerHTML=`
            <div class="critical-item">
                <div class="critical-left">
                    <span class="critical-priority major">No Critical</span>
                    <div>
                        <h4>All clear</h4>
                        <p>No critical tickets match the current filters.</p>
                    </div>
                </div>
                <span class="critical-age">0 hrs</span>
            </div>
        `;

        return;

    }

    container.innerHTML=criticalTickets.map(ticket=>{

        const ticketNumber = getTicketValue(ticket,["Ticket Number","Ticket No","Ticket","ticket"]) || "#---";

        const priority = getTicketValue(ticket,["Priority","priority"]) || "Unknown";

        const resolution = calculateResolution(ticket);

        const badgeClass = priority.toLowerCase().includes("critical") ? "critical" : "major";

        return `
            <div class="critical-item">
                <div class="critical-left">
                    <span class="critical-priority ${badgeClass}">${priority}</span>
                    <div>
                        <h4>${ticketNumber}</h4>
                        <p>${getTicketValue(ticket,["Problem Type","Problem","Fault Type","Issue Type"]) || "No issue description"}</p>
                    </div>
                </div>
                <span class="critical-age">${resolution>0 ? resolution.toFixed(1) : "0.0"} hrs</span>
            </div>
        `;

    }).join("");

}

/* ==========================================================
CHRONIC TICKETS
========================================================== */

const ASSET_COLUMN_NAMES=[
    "Device/Asset Name",
    "Asset Name",
    "Device Name",
    "Asset / Panel",
    "Asset/Panel",
    "Asset Panel",
    "Asset",
    "Asset ID",
    "Asset No",
    "Asset Number",
    "Panel",
    "Panel ID",
    "Panel No",
    "Panel Number",
    "Panel Name",
    "Serial Number",
    "Serial No",
    "Serial",
    "Device",
    "Device ID",
    "Equipment",
    "Equipment ID",
    "SLC ID",
    "SLC Serial",
    "Meter Serial"
];

const FAULT_COLUMN_NAMES=[
    "Problem Type",
    "Problem",
    "Fault Type",
    "Fault",
    "Issue Type",
    "Issue"
];

const DATE_COLUMN_NAMES=[
    "Opened Time",
    "Opened",
    "Created Time",
    "Created",
    "Date",
    "Last Seen",
    "Closed Time",
    "Ticket Date"
];

const EXCLUDED_ASSET_HEADERS=[
    /type/i,
    /problem/i,
    /fault/i,
    /issue/i,
    /status/i,
    /priority/i,
    /region/i,
    /zone/i,
    /ward/i,
    /opened/i,
    /closed/i,
    /created/i,
    /date/i,
    /time/i,
    /ticket/i,
    /resolution/i,
    /communication/i,
    /remark/i,
    /comment/i,
    /description/i
];

function renderChronicTickets(){

    const container=document.getElementById("chronicDeviceList");

    if(!container) return;

    const reportCard = document.getElementById("chronicInsightReport");
    const reportContent = document.getElementById("chronicInsightContent");

    if(!FILTERED_DATA.length){
        if (reportCard) reportCard.style.display = "none";

        container.innerHTML=`
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;">
                    Upload a CSV file to identify chronic-offender assets.
                </td>
            </tr>
        `;

        return;

    }

    const assetColumn=detectAssetColumn(FILTERED_DATA);
    const faultColumn=detectFaultColumn(FILTERED_DATA);
    const dateColumn=detectDateColumn(FILTERED_DATA);
    const chronicAssets=getChronicAssets(FILTERED_DATA,assetColumn,faultColumn,dateColumn);

    if(!assetColumn){
        if (reportCard) reportCard.style.display = "none";

        container.innerHTML=`
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;">
                    Could not detect an asset or panel column in the uploaded CSV.
                </td>
            </tr>
        `;

        return;

    }

    if(!chronicAssets.length){
        if (reportCard) reportCard.style.display = "none";

        container.innerHTML=`
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;">
                    No asset or panel has more than one ticket in the current filter set.
                </td>
            </tr>
        `;

        return;

    }

    const displayedChronic = chronicAssets.slice(0, 20);

    container.innerHTML=displayedChronic.map(asset=>`
        <tr>
            <td>${escapeHtml(asset.name)}</td>
            <td>${asset.count}</td>
            <td>${escapeHtml(asset.primaryFault)}</td>
            <td>${escapeHtml(asset.lastProblems.join(", "))}</td>
            <td>${escapeHtml(asset.lastSeen)}</td>
            <td>${escapeHtml(asset.action)}</td>
        </tr>
    `).join("");

    if (reportCard && reportContent) {
        const worstOffenders = [...chronicAssets].sort((a, b) => b.count - a.count).slice(0, 3);
        if (worstOffenders.length > 0) {
            let htmlReport = "<ul style='margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px;'>";
            worstOffenders.forEach(asset => {
                htmlReport += `
                    <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.5;">
                        The device/panel <strong style="color: var(--white);">${escapeHtml(asset.name)}</strong> has received 
                        <strong style="color: var(--primary);">${asset.count}</strong> complaints in the active range, 
                        primarily regarding <strong style="color: var(--white);">${escapeHtml(asset.primaryFault)}</strong>. 
                        <span style="color: #ef4444; font-weight: 500;">Please inspect this device before it leads to a major operational problem.</span>
                    </li>
                `;
            });
            htmlReport += "</ul>";
            reportContent.innerHTML = htmlReport;
            reportCard.style.display = "block";
        } else {
            reportCard.style.display = "none";
        }
    }

}

/* ==========================================================
NOISY DEVICES & FLAPPING DETECTION
========================================================== */

function renderNoisyDevices() {
    const container = document.getElementById("noisyDeviceList");
    if (!container) return;

    if (!FILTERED_DATA.length) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;">
                    Upload a CSV file to identify noisy devices.
                </td>
            </tr>
        `;
        return;
    }

    const assetColumn = detectAssetColumn(FILTERED_DATA);
    const faultColumn = detectFaultColumn(FILTERED_DATA);
    const dateColumn = detectDateColumn(FILTERED_DATA);

    if (!assetColumn) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;">
                    Could not detect an asset or panel column in the uploaded CSV.
                </td>
            </tr>
        `;
        return;
    }

    const noisyDevices = getNoisyDevices(FILTERED_DATA, assetColumn, faultColumn, dateColumn);

    if (!noisyDevices.length) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;">
                    No devices with flapping rate exceeding 5 tickets in a 24-hour window.
                </td>
            </tr>
        `;
        return;
    }

    const displayedNoisy = noisyDevices.slice(0, 15);

    container.innerHTML = displayedNoisy.map(device => `
        <tr>
            <td style="font-weight: 600; color: var(--white);">${escapeHtml(device.name)}</td>
            <td style="color: var(--orange); font-weight: 700;">${device.maxFlapRate} tickets / 24h</td>
            <td>${device.totalTickets}</td>
            <td>${escapeHtml(device.primaryFault)}</td>
            <td style="color: var(--blue); font-weight: 600;">${device.autoCloseRate}</td>
            <td style="color: var(--primary); font-weight: 500;">${escapeHtml(device.action)}</td>
        </tr>
    `).join("");
}

function getNoisyDevices(records, assetColumn, faultColumn, dateColumn) {
    const groups = new Map();

    records.forEach(ticket => {
        const asset = getColumnValue(ticket, assetColumn) || getTicketValue(ticket, ASSET_COLUMN_NAMES);
        if (!asset) return;

        if (!groups.has(asset)) {
            groups.set(asset, []);
        }
        groups.get(asset).push(ticket);
    });

    const noisyDevices = [];

    groups.forEach((tickets, name) => {
        const sortedTickets = tickets
            .map(t => ({
                ticket: t,
                date: parseTicketDate(t, dateColumn)
            }))
            .filter(item => item.date)
            .sort((a, b) => a.date - b.date);

        if (sortedTickets.length === 0) return;

        let maxFlapRate = 0;
        const dates = sortedTickets.map(item => item.date);

        for (let i = 0; i < dates.length; i++) {
            let count = 1;
            const limitTime = dates[i].getTime() + 24 * 60 * 60 * 1000;
            for (let j = i + 1; j < dates.length; j++) {
                if (dates[j].getTime() <= limitTime) {
                    count++;
                } else {
                    break;
                }
            }
            if (count > maxFlapRate) {
                maxFlapRate = count;
            }
        }

        if (maxFlapRate <= 5) return;

        let closedCount = 0;
        let autoClosedCount = 0;

        tickets.forEach(t => {
            const status = (t.Status || t.status || "").toLowerCase();
            const isClosed = status.includes("closed") || status.includes("resolved") || status.includes("done");
            if (isClosed) {
                closedCount++;
                const resHrs = calculateResolution(t);
                const durationMinutes = resHrs * 60;
                if (resHrs > 0 && durationMinutes <= 5) {
                    autoClosedCount++;
                }
            }
        });

        const autoCloseRate = closedCount === 0 ? 0 : (autoClosedCount / closedCount) * 100;
        const primaryFault = getPrimaryFault(tickets, faultColumn);

        let action = "Monitor connection";
        if (maxFlapRate > 15) {
            action = "Inspect Relay / Relay replacement candidate";
        } else if (maxFlapRate > 8) {
            action = "Deep inspect relay & connection stability";
        }

        noisyDevices.push({
            name,
            maxFlapRate,
            totalTickets: tickets.length,
            primaryFault,
            autoCloseRate: autoCloseRate.toFixed(1) + "%",
            action
        });
    });

    return noisyDevices.sort((a, b) => b.maxFlapRate - a.maxFlapRate);
}

function detectAssetColumn(records){

    const explicitColumn=resolveTicketColumn(ASSET_COLUMN_NAMES);

    if(explicitColumn && getColumnFillRate(records,explicitColumn)>=0.2){

        return explicitColumn;

    }

    for(const partial of ["asset","panel","serial","device","equipment","slc","meter"]){

        const column=findColumnByPartial(partial);

        if(column && !isExcludedAssetHeader(column) && getColumnFillRate(records,column)>=0.2){

            return column;

        }

    }

    return findBestGroupingColumn(records);

}

function detectFaultColumn(records){

    const column=resolveTicketColumn(FAULT_COLUMN_NAMES);

    if(column && getColumnFillRate(records,column)>=0.2){

        return column;

    }

    return findColumnByPartial("problem")
        || findColumnByPartial("fault")
        || findColumnByPartial("issue")
        || null;

}

function detectDateColumn(records){

    const column=resolveTicketColumn(DATE_COLUMN_NAMES);

    if(column && getColumnFillRate(records,column)>=0.2){

        return column;

    }

    return findColumnByPartial("opened")
        || findColumnByPartial("created")
        || findColumnByPartial("date")
        || null;

}

function getChronicAssets(records,assetColumn,faultColumn,dateColumn){

    const groups=new Map();

    records.forEach(ticket=>{

        const asset=getColumnValue(ticket,assetColumn) || getTicketValue(ticket,ASSET_COLUMN_NAMES);

        if(!asset) return;

        // Filter for panels (type contains 'panel' or name starts with 'SS'/'SSC')
        const assetType = (getTicketValue(ticket, ["Device/Asset Type", "Asset Type", "Type"]) || "").toLowerCase();
        const isPanel = assetType.includes("panel") || asset.startsWith("SS") || asset.startsWith("SSC");
        if (!isPanel) return;

        if(!groups.has(asset)){

            groups.set(asset,[]);

        }

        groups.get(asset).push(ticket);

    });

    return Array.from(groups.entries())

        .filter(([,tickets])=>tickets.length>1)

        .map(([name,tickets])=>({

            name,

            count:tickets.length,

            primaryFault:getPrimaryFault(tickets,faultColumn),

            lastProblems:getLastProblemTypes(tickets,faultColumn,dateColumn,3),

            lastSeen:getLastSeenDate(tickets,dateColumn),

            action:"Replace / deep inspect"

        }))

        .sort((a,b)=>b.count-a.count)
        .slice(0, 20);

}

function getPrimaryFault(tickets,faultColumn){

    const counts=new Map();

    tickets.forEach(ticket=>{

        const issue=getColumnValue(ticket,faultColumn) || getTicketValue(ticket,FAULT_COLUMN_NAMES);

        if(!issue) return;

        counts.set(issue,(counts.get(issue)||0)+1);

    });

    let primaryFault="Unknown";

    let topCount=0;

    counts.forEach((count,issue)=>{

        if(count>topCount){

            topCount=count;

            primaryFault=issue;

        }

    });

    return primaryFault;

}

function getLastProblemTypes(tickets,faultColumn,dateColumn,limit){

    const datedTickets=tickets

        .map(ticket=>({

            issue:getColumnValue(ticket,faultColumn) || getTicketValue(ticket,FAULT_COLUMN_NAMES),

            date:parseTicketDate(ticket,dateColumn)

        }))

        .filter(item=>item.issue)

        .sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));

    const seen=new Set();

    const problems=[];

    datedTickets.forEach(item=>{

        if(seen.has(item.issue)) return;

        seen.add(item.issue);

        problems.push(item.issue);

    });

    return problems.slice(0,limit);

}

function getLastSeenDate(tickets,dateColumn){

    const dates=tickets

        .map(ticket=>parseTicketDate(ticket,dateColumn))

        .filter(Boolean);

    if(!dates.length) return "—";

    const latest=new Date(Math.max(...dates.map(date=>date.getTime())));

    return latest.toISOString().slice(0,10);

}

function parseTicketDate(ticket,dateColumn){

    const rawValue=dateColumn
        ? getColumnValue(ticket,dateColumn)
        : getTicketValue(ticket,DATE_COLUMN_NAMES);

    if(!rawValue) return null;

    const parsed=new Date(rawValue);

    return isNaN(parsed.getTime()) ? null : parsed;

}

function getColumnValue(ticket,column){

    if(!column || ticket[column]===undefined || ticket[column]===null) return "";

    return String(ticket[column]).trim();

}

function getColumnFillRate(records,column){

    if(!records.length || !column) return 0;

    const filled=records.filter(ticket=>getColumnValue(ticket,column)).length;

    return filled/records.length;

}

function isExcludedAssetHeader(header){

    return EXCLUDED_ASSET_HEADERS.some(pattern=>pattern.test(header));

}

function findColumnByPartial(partialMatch){

    const records=FILTERED_DATA.length ? FILTERED_DATA : RAW_DATA;

    const sample=records[0];

    if(!sample || !partialMatch) return null;

    const matches=Object.keys(sample).filter(header=>

        normalizeHeader(header).includes(normalizeHeader(partialMatch))

    );

    if(!matches.length) return null;

    let bestColumn=matches[0];

    let bestScore=-1;

    matches.forEach(header=>{

        if(partialMatch!=="problem" && partialMatch!=="fault" && partialMatch!=="issue" && isExcludedAssetHeader(header)){

            return;

        }

        const fillRate=getColumnFillRate(records,header);

        let score=fillRate*100;

        const normalized=normalizeHeader(header);

        if(normalized.includes("asset") || normalized.includes("panel") || normalized.includes("serial")){

            score+=50;

        }

        if(score>bestScore){

            bestScore=score;

            bestColumn=header;

        }

    });

    return bestColumn;

}

function findBestGroupingColumn(records){

    const headers=Object.keys(records[0] || {});

    let bestColumn=null;

    let bestScore=0;

    headers.forEach(header=>{

        if(isExcludedAssetHeader(header)) return;

        const values=records

            .map(ticket=>getColumnValue(ticket,header))

            .filter(value=>value.length>=4);

        if(values.length<records.length*0.2) return;

        const counts=new Map();

        values.forEach(value=>counts.set(value,(counts.get(value)||0)+1));

        const repeatGroups=[...counts.values()].filter(count=>count>1).length;

        const maxRepeat=Math.max(...counts.values(),0);

        const unique=counts.size;

        const avgRepeat=values.length/unique;

        if(avgRepeat<1.2 || repeatGroups===0) return;

        const score=(repeatGroups*20)+maxRepeat+(values.length/records.length)*10;

        if(score>bestScore){

            bestScore=score;

            bestColumn=header;

        }

    });

    return bestColumn;

}

function resolveTicketColumn(possibleNames,partialMatch=""){

    const sample=FILTERED_DATA[0] || RAW_DATA[0];

    if(!sample) return null;

    const headers=Object.keys(sample);

    for(const name of possibleNames){

        const found=headers.find(header=>normalizeHeader(header)===normalizeHeader(name));

        if(found) return found;

    }

    if(partialMatch){

        return findColumnByPartial(partialMatch);

    }

    return null;

}

function normalizeHeader(value){

    return String(value || "")
        .replace(/^\uFEFF/,"")
        .toLowerCase()
        .replace(/\s*\/\s*/g,"/")
        .replace(/\s+/g," ")
        .trim();

}

function escapeHtml(value){

    return String(value || "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");

}

function normalizeText(value){

    return String(value || "").toLowerCase().trim();

}

function getTicketValue(ticket, possibleKeys){

    for(const key of possibleKeys){

        if(ticket[key] !== undefined && ticket[key] !== null && String(ticket[key]).trim() !== ""){

            return String(ticket[key]);

        }

    }

    const headers=Object.keys(ticket);

    for(const name of possibleKeys){

        const found=headers.find(header=>normalizeHeader(header)===normalizeHeader(name));

        if(found && ticket[found] !== undefined && ticket[found] !== null && String(ticket[found]).trim() !== ""){

            return String(ticket[found]);

        }

    }

    return "";

}

/* ==========================================================
CSV DATABASE OPERATIONS & UI HELPERS
========================================================== */

function clearDatabase() {
    if (!confirm("Are you sure you want to clear the entire database? This will delete all saved tickets from the server and cannot be undone.")) {
        return;
    }
    
    showToast("Clearing database...", "info");
    
    fetch('/api/clear', {
        method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            RAW_DATA = [];
            FILTERED_DATA = [];
            LOADED_FILES.clear();
            
            document.getElementById("csvName").textContent = "Database Empty";
            document.getElementById("recordCount").textContent = "0";
            document.getElementById("lastRefresh").textContent = new Date().toLocaleString();
            
            initializeDashboard();
            showToast("Database cleared successfully!", "success");
        } else {
            showToast("Failed to clear database: " + (data.error || "Unknown error"), "error");
        }
    })
    .catch(err => {
        showToast("Error connecting to server: " + err.message, "error");
    });
}

function uploadTicketsToServer(tickets) {
    showToast(`Uploading ${tickets.length} tickets to server...`, "info");
    
    fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tickets)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(`Successfully uploaded! Added ${data.added_count} new tickets.`, "success");
            loadMainCsvOnStartup();
        } else {
            showToast("Upload failed: " + (data.error || "Unknown error"), "error");
        }
    })
    .catch(err => {
        showToast("Error uploading tickets: " + err.message, "error");
    });
}

function standardizeTicket(row) {
    const ticketKeys = ["Ticket No", "Ticket Number", "Ticket", "ticket", "Ticket ID", "TicketID"];
    const regionKeys = ["Region", "region", "Project", "project"];
    const zoneKeys = ["Zone", "zone"];
    const wardKeys = ["Ward", "ward"];
    const complaineeKeys = ["Complainee", "complainee", "Complainer", "complainer", "Complainant", "complainant"];
    const deviceTypeKeys = ["Device/Asset Type", "Device Type", "Asset Type", "device_type", "asset_type"];
    const deviceNameKeys = ["Device/Asset Name", "Device Name", "Asset Name", "device_name", "asset_name", "Asset / Panel", "Asset/Panel", "Asset Panel", "Asset", "Asset ID", "Asset No", "Asset Number", "Panel", "Panel ID", "Panel No", "Panel Number", "Panel Name", "Serial Number", "Serial No", "Serial", "Device", "Device ID", "Equipment", "Equipment ID", "SLC ID", "SLC Serial", "Meter Serial"];
    const problemKeys = ["Problem Type", "Problem", "Fault Type", "Fault", "Issue Type", "Issue", "problem_type", "fault_type", "issue_type"];
    const statusKeys = ["Status", "status", "State", "state"];
    const priorityKeys = ["Priority", "priority", "Severity", "severity"];
    const assigneeKeys = ["Assignee", "assignee", "Assigned To", "assigned_to"];
    const openedTimeKeys = ["Opened Time", "Opened", "Created Time", "Created", "Date", "date", "opened", "created", "Ticket Date", "OpenedTime"];
    const closedTimeKeys = ["Closed Time", "Closed", "ClosedTime", "closed"];
    const durationKeys = ["Duration (Days)", "Duration", "duration", "Duration Days", "Duration(Days)"];
    const locationKeys = ["Location", "location", "Address", "address"];
    const commentsKeys = ["Latest Comments", "Comments", "LatestComments", "comments", "Remark", "Remarks", "remark", "remarks", "Comment", "comment"];
    const phoneKeys = ["Complainee Phone Number", "Complainee Phone", "Phone Number", "Phone", "Mobile", "mobile", "Mobile Number", "mobile_number", "Complainee Mobile"];

    return {
        "Ticket No": getTicketValue(row, ticketKeys) || "",
        "Region": getTicketValue(row, regionKeys) || "UNKNOWN",
        "Zone": getTicketValue(row, zoneKeys) || "",
        "Ward": getTicketValue(row, wardKeys) || "",
        "Complainee": getTicketValue(row, complaineeKeys) || "System",
        "Device/Asset Type": getTicketValue(row, deviceTypeKeys) || "ILM",
        "Device/Asset Name": getTicketValue(row, deviceNameKeys) || "",
        "Problem Type": getTicketValue(row, problemKeys) || "Unknown",
        "Status": getTicketValue(row, statusKeys) || "Open",
        "Priority": getTicketValue(row, priorityKeys) || "Minor",
        "Assignee": getTicketValue(row, assigneeKeys) || "Unassigned",
        "Opened Time": getTicketValue(row, openedTimeKeys) || "",
        "Closed Time": getTicketValue(row, closedTimeKeys) || "",
        "Duration (Days)": parseFloat(getTicketValue(row, durationKeys)) || 0.0,
        "Location": getTicketValue(row, locationKeys) || "",
        "Latest Comments": getTicketValue(row, commentsKeys) || "",
        "Complainee Phone Number": getTicketValue(row, phoneKeys) || ""
    };
}

/* ==========================================================
TOAST NOTIFICATION SYSTEM
========================================================== */
function showToast(message, type = "info") {
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    
    const toast = document.createElement("div");
    toast.className = `toast-message ${type}`;
    
    let iconClass = "fa-circle-info";
    if (type === "success") iconClass = "fa-circle-check";
    if (type === "error") iconClass = "fa-circle-exclamation";
    
    toast.innerHTML = `
        <i class="toast-icon fa-solid ${iconClass}"></i>
        <div class="toast-text">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add("show");
    }, 10);
    
    const autoRemove = setTimeout(() => {
        dismissToast(toast);
    }, 4000);
    
    toast.querySelector(".toast-close").addEventListener("click", () => {
        clearTimeout(autoRemove);
        dismissToast(toast);
    });
}

function dismissToast(toast) {
    toast.classList.remove("show");
    setTimeout(() => {
        toast.remove();
        const container = document.querySelector(".toast-container");
        if (container && container.children.length === 0) {
            container.remove();
        }
    }, 400);
}

function loadMainCsvOnStartup() {
    fetch('main.csv?v=' + Date.now())
    .then(res => {
        if (res.ok) return res.text();
        throw new Error('main.csv not found on server');
    })
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(result) {
                RAW_DATA = normalizeCsvRows(result.data);
                FILTERED_DATA = [...RAW_DATA];
                
                LOADED_FILES.add("main.csv");
                
                if (RAW_DATA.length > 0) {
                    document.getElementById("csvName").textContent = "main.csv (Synced)";
                } else {
                    document.getElementById("csvName").textContent = "Database Empty";
                }
                
                document.getElementById("recordCount").textContent = RAW_DATA.length;
                document.getElementById("lastRefresh").textContent = new Date().toLocaleString();
                
                initializeDashboard();
            }
        });
    })
    .catch(err => {
        console.log("Auto-load info:", err.message);
    });
}

/* ==========================================================
PREDICTIVE MAINTENANCE RENDERER
========================================================== */

function renderPredictiveRisk() {
    const container = document.getElementById("predictiveRiskList");
    if (!container) return;

    const highBtn = document.querySelector("#predictiveRiskFilters .filter-button[data-risk='High']");
    const mediumBtn = document.querySelector("#predictiveRiskFilters .filter-button[data-risk='Medium']");
    const lowBtn = document.querySelector("#predictiveRiskFilters .filter-button[data-risk='Low']");
    const allBtn = document.querySelector("#predictiveRiskFilters .filter-button[data-risk='All']");

    if (!FILTERED_DATA.length) {
        if (highBtn) highBtn.textContent = "High Risk (0)";
        if (mediumBtn) mediumBtn.textContent = "Medium Risk (0)";
        if (lowBtn) lowBtn.textContent = "Low Risk (0)";
        if (allBtn) allBtn.textContent = "All Levels (0)";
        const showMoreBtn = document.getElementById("showMoreRiskBtn");
        if (showMoreBtn) showMoreBtn.style.display = "none";
        const showLessBtn = document.getElementById("showLessRiskBtn");
        if (showLessBtn) showLessBtn.style.display = "none";

        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:40px;">
                    Upload a CSV file to evaluate failure risk.
                </td>
            </tr>
        `;
        return;
    }

    const allPredictions = runPredictiveMaintenanceModel(FILTERED_DATA);

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    allPredictions.forEach(device => {
        if (device.riskLevel === "High") highCount++;
        else if (device.riskLevel === "Medium") mediumCount++;
        else if (device.riskLevel === "Low") lowCount++;
    });
    const allCount = allPredictions.length;

    if (highBtn) highBtn.textContent = `High Risk (${highCount})`;
    if (mediumBtn) mediumBtn.textContent = `Medium Risk (${mediumCount})`;
    if (lowBtn) lowBtn.textContent = `Low Risk (${lowCount})`;
    if (allBtn) allBtn.textContent = `All Levels (${allCount})`;

    let predictions = allPredictions;
    if (currentPredictiveRiskFilter !== "All") {
        predictions = predictions.filter(device => device.riskLevel === currentPredictiveRiskFilter);
    }

    const showMoreBtn = document.getElementById("showMoreRiskBtn");
    const showLessBtn = document.getElementById("showLessRiskBtn");

    if (predictions.length > displayedPredictiveRiskCount) {
        if (showMoreBtn) showMoreBtn.style.display = "flex";
    } else {
        if (showMoreBtn) showMoreBtn.style.display = "none";
    }

    if (displayedPredictiveRiskCount > 20) {
        if (showLessBtn) showLessBtn.style.display = "flex";
    } else {
        if (showLessBtn) showLessBtn.style.display = "none";
    }

    const displayedPredictions = predictions.slice(0, displayedPredictiveRiskCount);

    if (!displayedPredictions.length) {
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:40px;">
                    No assets at the ${currentPredictiveRiskFilter} risk level in the filtered set.
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = displayedPredictions.map(device => {
        const percent = (device.probability * 100).toFixed(0);
        
        let color = "#22C55E";
        if (device.riskLevel === "High") {
            color = "#EF4444";
        } else if (device.riskLevel === "Medium") {
            color = "#F97316";
        }

        const progressBarHtml = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="flex: 1; height: 8px; background: #203042; border-radius: 4px; overflow: hidden; min-width: 100px;">
                    <div style="height: 100%; width: ${percent}%; background: ${color}; border-radius: 4px;"></div>
                </div>
                <strong style="color: ${color}; font-weight: 700; width: 45px; text-align: right;">${percent}%</strong>
            </div>
        `;

        let badgeBg = "rgba(34, 197, 94, 0.15)";
        let badgeColor = "#22C55E";
        if (device.riskLevel === "High") {
            badgeBg = "rgba(239, 68, 68, 0.15)";
            badgeColor = "#EF4444";
        } else if (device.riskLevel === "Medium") {
            badgeBg = "rgba(249, 115, 22, 0.15)";
            badgeColor = "#F97316";
        }

        const badgeHtml = `
            <span style="padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; background: ${badgeBg}; color: ${badgeColor}; display: inline-block;">
                ${device.riskLevel}
            </span>
        `;

        return `
            <tr>
                <td style="font-weight: 600; color: var(--white);">${escapeHtml(device.name)}</td>
                <td>${progressBarHtml}</td>
                <td>${badgeHtml}</td>
                <td style="text-align: center; color: var(--white); font-weight: 500;">${device.recentFailures}</td>
                <td style="text-align: center; color: var(--muted);">${device.daysSinceLast} days ago</td>
                <td style="color: var(--orange); font-weight: 600; text-align: center;">${device.flapRate} / 24h</td>
                <td style="color: var(--primary); font-weight: 500;">${escapeHtml(device.recommendation)}</td>
            </tr>
        `;
    }).join("");
}

function initializePredictiveRiskListeners() {
    const buttons = document.querySelectorAll("#predictiveRiskFilters .filter-button");
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            buttons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            currentPredictiveRiskFilter = button.getAttribute("data-risk");
            displayedPredictiveRiskCount = 20;
            renderPredictiveRisk();
        });
    });

    const showMoreBtn = document.getElementById("showMoreRiskBtn");
    if (showMoreBtn) {
        showMoreBtn.addEventListener("click", () => {
            displayedPredictiveRiskCount += 15;
            renderPredictiveRisk();
        });
    }

    const showLessBtn = document.getElementById("showLessRiskBtn");
    if (showLessBtn) {
        showLessBtn.addEventListener("click", () => {
            displayedPredictiveRiskCount = 20;
            renderPredictiveRisk();
        });
    }
}
