/* ==========================================================
SMART LIGHT TICKET MONITORING SYSTEM
Filter Engine
========================================================== */

const filterIds = {

    region: "regionFilter",

    zone: "zoneFilter",

    ward: "wardFilter",

    priority: "priorityFilter",

    customer: "customerFilter",

    deviceType: "deviceTypeFilter",

    problemType: "problemTypeFilter",

    assignee: "assigneeFilter",

    complainee: "complaineeFilter",

    startDate: "startDateFilter",

    endDate: "endDateFilter"

};

// Track selected filters for button-based filters
let selectedStatuses = new Set();

let selectedTicketStates = new Set(["All"]);

/* ==========================================================
LOAD FILTERS
========================================================== */

function loadFilters(){

    const customerMap = (window.APP_CONFIG && window.APP_CONFIG.customerRegionsMap) || {};
    const customers = Object.keys(customerMap);
    loadCustomDropdown(filterIds.customer, customers);

    updateCascadingDropdowns();

    loadDropdown(

        filterIds.priority,

        findColumn(["Priority","priority"]),

        RAW_DATA

    );

    loadDropdown(

        filterIds.deviceType,

        findColumn(["Device/Asset Type","Device Type","device_type","entity_type"]),

        RAW_DATA

    );

    loadDropdown(

        filterIds.problemType,

        findColumn(["Problem Type","Problem","problem_type"]),

        RAW_DATA

    );

    loadDropdown(

        filterIds.assignee,

        findColumn(["Assignee","assignee"]),

        RAW_DATA

    );

    loadDropdown(

        filterIds.complainee,

        findColumn(["Complainee","complainee"]),

        RAW_DATA

    );

    loadStatusButtons(findColumn(["Status","status"]));

    if(!filtersInitialized){

        initializeFilterEvents();

        filtersInitialized = true;

        // Apply URL filters on initial load after events are registered
        applyUrlFilters();

    }

}

/* ==========================================================
LOAD CASCADING DROPDOWNS
========================================================== */

function updateCascadingDropdowns(){

    const customerColumn = findColumn(["Customer","customer","customer_name"]);
    const regionColumn = findColumn(["Region","region"]);
    const zoneColumn = findColumn(["Zone","zone"]);
    const wardColumn = findColumn(["Ward","ward"]);

    const customerSelect = document.getElementById(filterIds.customer);
    const selectedCustomer = customerSelect ? customerSelect.value : "All";

    const customerMap = (window.APP_CONFIG && window.APP_CONFIG.customerRegionsMap) || {};

    // 1. Filter Region dropdown options based on selected Customer from static map
    let regions = [];
    if(selectedCustomer === "All"){
        // If All Customers selected, show all unique regions from our static map
        const allRegions = new Set();
        Object.values(customerMap).forEach(regs => {
            regs.forEach(r => allRegions.add(r));
        });
        regions = Array.from(allRegions);
    } else {
        // Otherwise show only regions belonging to this customer
        regions = customerMap[selectedCustomer] || [];
    }
    loadCustomDropdown(filterIds.region, regions);

    // Get current region selection (might have reset to "All" if invalid after customer reload)
    const regionSelect = document.getElementById(filterIds.region);
    const selectedRegion = regionSelect ? regionSelect.value : "All";

    // 2. Filter records for Zone dropdown based on selected Customer AND Region
    let zoneRecords = RAW_DATA;
    if(selectedCustomer !== "All" && customerColumn){
        zoneRecords = zoneRecords.filter(r=>{
            const val = r[customerColumn];
            return val && String(val).trim() === String(selectedCustomer).trim();
        });
    }
    if(selectedRegion !== "All" && regionColumn){
        zoneRecords = zoneRecords.filter(r=>{
            const val = r[regionColumn];
            return val && String(val).trim() === String(selectedRegion).trim();
        });
    }
    loadDropdown(filterIds.zone, zoneColumn, zoneRecords);

    // Get current zone selection (might have reset to "All" if invalid after region reload)
    const zoneSelect = document.getElementById(filterIds.zone);
    const selectedZone = zoneSelect ? zoneSelect.value : "All";

    // 3. Filter records for Ward dropdown based on selected Customer AND Region AND Zone
    let wardRecords = zoneRecords;
    if(selectedZone !== "All" && zoneColumn){
        wardRecords = zoneRecords.filter(r=>{
            const val = r[zoneColumn];
            return val && String(val).trim() === String(selectedZone).trim();
        });
    }
    loadDropdown(filterIds.ward, wardColumn, wardRecords);

}

/* ==========================================================
LOAD SINGLE DROPDOWN
========================================================== */

function loadDropdown(

    id,

    column,

    records

){

    const select=document.getElementById(id);

    if(!select || !column) return;

    const currentValue = select.value || "All";

    const values=[
        ...new Set(
            (records || RAW_DATA)
            .map(r=>r[column])
            .filter(Boolean)
        )
    ];

    values.sort();

    select.innerHTML="<option value=\"All\">All</option>";

    values.forEach(value=>{

        const option=document.createElement("option");

        option.value=value;

        option.textContent=value;

        select.appendChild(option);

    });

    if (values.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = "All";
    }

}

/* ==========================================================
LOAD CUSTOM LIST DROPDOWN
========================================================== */

function loadCustomDropdown(id, optionsList){

    const select = document.getElementById(id);

    if(!select || !optionsList) return;

    const currentValue = select.value || "All";

    select.innerHTML = "<option value=\"All\">All</option>";

    optionsList.sort().forEach(value => {

        const option = document.createElement("option");

        option.value = value;

        option.textContent = value;

        select.appendChild(option);

    });

    if (optionsList.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = "All";
    }

}

/* ==========================================================
LOAD STATUS BUTTONS (MULTI-SELECT)
========================================================== */

function loadStatusButtons(column){

    const container=document.getElementById("statusFilterButtons");

    if(!container || !column) return;

    const values=[
        ...new Set(
            RAW_DATA
            .map(r=>r[column])
            .filter(Boolean)
        )
    ];

    values.sort();

    container.innerHTML="";

    // Add "All" button first
    const allBtn=document.createElement("button");

    allBtn.className="filter-button active";

    allBtn.dataset.value="All";

    allBtn.textContent="All";

    allBtn.addEventListener("click",()=>handleStatusFilterClick("All"));

    container.appendChild(allBtn);

    // Add individual status buttons
    values.forEach(value=>{

        const btn=document.createElement("button");

        btn.className="filter-button";

        btn.dataset.value=value;

        btn.textContent=value;

        btn.addEventListener("click",()=>handleStatusFilterClick(value));

        container.appendChild(btn);

    });

}

/* ==========================================================
HANDLE STATUS FILTER BUTTON CLICK
========================================================== */

function handleStatusFilterClick(value){

    const buttons=document.querySelectorAll("#statusFilterButtons .filter-button");

    if(value==="All"){

        // Clear all selections and select "All"
        selectedStatuses.clear();

        buttons.forEach(btn=>{

            btn.classList.remove("active");

            if(btn.dataset.value==="All"){

                btn.classList.add("active");

            }

        });

    }else{

        // Remove "All" if it was selected
        const allBtn=document.querySelector('#statusFilterButtons [data-value="All"]');

        if(allBtn && allBtn.classList.contains("active")){

            allBtn.classList.remove("active");

            selectedStatuses.clear();

        }

        // Toggle the selected status
        if(selectedStatuses.has(value)){

            selectedStatuses.delete(value);

            const btn=document.querySelector(`#statusFilterButtons [data-value="${value}"]`);

            btn.classList.remove("active");

        }else{

            selectedStatuses.add(value);

            const btn=document.querySelector(`#statusFilterButtons [data-value="${value}"]`);

            btn.classList.add("active");

        }

        // If no statuses selected, select "All"
        if(selectedStatuses.size===0){

            selectedStatuses.clear();

            allBtn.classList.add("active");

        }

    }

    applyFilters();

}

/* ==========================================================
HANDLE TICKET STATE FILTER BUTTON CLICK
========================================================== */

function handleTicketStateFilterClick(value){

    const buttons=document.querySelectorAll("#ticketStateFilterButtons .filter-button");

    if(value==="All"){

        selectedTicketStates.clear();

        selectedTicketStates.add("All");

        buttons.forEach(btn=>btn.classList.remove("active"));

        buttons.forEach(btn=>{

            if(btn.dataset.value==="All"){

                btn.classList.add("active");

            }

        });

    }else{

        // Remove "All" if it was selected
        if(selectedTicketStates.has("All")){

            selectedTicketStates.delete("All");

            const allBtn=document.querySelector('#ticketStateFilterButtons [data-value="All"]');

            allBtn.classList.remove("active");

        }

        // Toggle the selected state
        if(selectedTicketStates.has(value)){

            selectedTicketStates.delete(value);

            const btn=document.querySelector(`#ticketStateFilterButtons [data-value="${value}"]`);

            btn.classList.remove("active");

        }else{

            selectedTicketStates.add(value);

            const btn=document.querySelector(`#ticketStateFilterButtons [data-value="${value}"]`);

            btn.classList.add("active");

        }

        // If no states selected, select "All"
        if(selectedTicketStates.size===0){

            selectedTicketStates.add("All");

            const allBtn=document.querySelector('#ticketStateFilterButtons [data-value="All"]');

            allBtn.classList.add("active");

        }

    }

    applyFilters();

}

/* ==========================================================
FILTER EVENTS
========================================================== */

function initializeFilterEvents(){

    // Initialize dropdown and date filters
    Object.values(filterIds).forEach(id=>{

        const element = document.getElementById(id);

        if(element){

            element.addEventListener("change", applyFilters);

            if(element.tagName === "INPUT" && element.type === "date"){
                element.addEventListener("input", applyFilters);
            }

        }

    });

    // Initialize ticket state button filters
    const ticketStateButtons=document.querySelectorAll("#ticketStateFilterButtons .filter-button");

    ticketStateButtons.forEach(btn=>{

        btn.addEventListener("click",(e)=>{

            e.preventDefault();

            handleTicketStateFilterClick(btn.dataset.value);

        });

    });

    // Initialize and synchronize search boxes
    const searchBox1 = document.getElementById("ticketSearch");
    const searchBox2 = document.getElementById("ticketTableSearch");

    if(searchBox1){
        searchBox1.addEventListener("keyup", (e) => {
            if(searchBox2) searchBox2.value = e.target.value;
            applyFilters();
        });
    }

    if(searchBox2){
        searchBox2.addEventListener("keyup", (e) => {
            if(searchBox1) searchBox1.value = e.target.value;
            applyFilters();
        });
    }

}
/* ==========================================================
APPLY FILTERS
========================================================== */

function applyFilters(){

    updateCascadingDropdowns();

    FILTERED_DATA=RAW_DATA.filter(ticket=>{

        return(

            matches(

                ticket,

                findColumn(["Region","region"]),

                filterIds.region

            )

            &&

            matches(

                ticket,

                findColumn(["Zone","zone"]),

                filterIds.zone

            )

            &&

            matches(

                ticket,

                findColumn(["Ward","ward"]),

                filterIds.ward

            )

            &&

            matches(

                ticket,

                findColumn(["Priority","priority"]),

                filterIds.priority

            )

            &&

            matches(

                ticket,

                findColumn(["Customer","customer","customer_name"]),

                filterIds.customer

            )

            &&

            matches(

                ticket,

                findColumn(["Device/Asset Type","Device Type","device_type","entity_type"]),

                filterIds.deviceType

            )

            &&

            matches(

                ticket,

                findColumn(["Problem Type","Problem","problem_type"]),

                filterIds.problemType

            )

            &&

            matches(

                ticket,

                findColumn(["Assignee","assignee"]),

                filterIds.assignee

            )

            &&

            matches(

                ticket,

                findColumn(["Complainee","complainee"]),

                filterIds.complainee

            )

            &&

            matchesMultiSelectStatus(ticket)

            &&

            matchesMultiSelectTicketState(ticket)

            &&

            matchesDateRange(ticket)

            &&

            searchMatch(ticket)

        );

    });

    currentPage = 1;

    calculateKPIs();

    renderCharts();

    populateTable();

    updateCriticalAlerts();

    renderChronicTickets();

    renderNoisyDevices();

    renderPredictiveRisk();

}
/* ==========================================================
MATCH DROPDOWN
========================================================== */

function matches(

    ticket,

    column,

    filterId

){

    if(!column) return true;

    const select=document.getElementById(filterId);

    if(!select){

        return true;

    }

    const selected=select.value;

    if(selected==="All"){

        return true;

    }

    return String(ticket[column]).trim() === String(selected).trim();

}

/* ==========================================================
MATCH MULTI-SELECT STATUS (BUTTON FILTER)
========================================================== */

function matchesMultiSelectStatus(ticket){

    // If no specific statuses selected, show all
    if(selectedStatuses.size===0){

        return true;

    }

    const statusColumn=findColumn(["Status","status"]);

    if(!statusColumn){

        return true;

    }

    const ticketStatus=ticket[statusColumn];

    // Check if ticket status matches any selected status
    return Array.from(selectedStatuses).some(selectedStatus=>

        ticketStatus===selectedStatus

    );

}

/* ==========================================================
MATCH MULTI-SELECT TICKET STATE (OPENED/CLOSED)
========================================================== */

function matchesMultiSelectTicketState(ticket){

    // If "All" is selected, show all
    if(selectedTicketStates.has("All")){

        return true;

    }

    const statusColumn=findColumn(["Status","status"]);

    if(!statusColumn){

        return true;

    }

    const status=(ticket[statusColumn]||"").toLowerCase();

    const isClosed=status.includes("closed") || status.includes("resolved");

    // Check if ticket matches any selected state
    for(let state of selectedTicketStates){

        if(state==="Closed" && isClosed){

            return true;

        }

        if(state==="Opened" && !isClosed){

            return true;

        }

    }

    return false;

}

/* ==========================================================
MATCH DATE RANGE
========================================================== */

function matchesDateRange(ticket){

    const startEl = document.getElementById(filterIds.startDate);

    const endEl = document.getElementById(filterIds.endDate);

    if(!startEl || !endEl) return true;

    const startVal = startEl.value;

    const endVal = endEl.value;

    if(!startVal && !endVal) return true;

    const openedTimeCol = findColumn(["Opened Time", "Opened", "opened_time", "ticket_opened_on"]);

    if(!openedTimeCol) return true;

    const openedTimeStr = ticket[openedTimeCol];

    if(!openedTimeStr) return false;

    let dateStr = openedTimeStr.trim();
    if(dateStr.includes(" ") && !dateStr.includes("T")){
        dateStr = dateStr.replace(" ", "T");
    }

    const ticketDate = new Date(dateStr);

    if(isNaN(ticketDate.getTime())) return true;

    if(startVal){

        const startDate = new Date(startVal + "T00:00:00");

        if(ticketDate < startDate) return false;

    }

    if(endVal){

        const endDate = new Date(endVal + "T23:59:59");

        if(ticketDate > endDate) return false;

    }

    return true;

}

/* ==========================================================
SEARCH
========================================================== */

function searchMatch(ticket){

    const keyword1 = document.getElementById("ticketSearch")?.value || "";
    const keyword2 = document.getElementById("ticketTableSearch")?.value || "";
    const keyword = (keyword1 || keyword2).toLowerCase().trim();

    if(keyword===""){

        return true;

    }

    return Object.values(ticket)

        .join(" ")

        .toLowerCase()

        .includes(keyword);

}
/* ==========================================================
FIND COLUMN
========================================================== */

function findColumn(possibleNames){

    if(RAW_DATA.length===0){

        return null;

    }

    const headers=Object.keys(RAW_DATA[0]);

    for(const name of possibleNames){

        const found=headers.find(

            h=>h.toLowerCase()===name.toLowerCase()

        );

        if(found){

            return found;

        }

    }

    return null;

}

/* ==========================================================
APPLY URL FILTERS (ON STARTUP)
========================================================== */

function applyUrlFilters(){

    const urlParams = new URLSearchParams(window.location.search);

    let hasChanges = false;

    // 1. Direct query parameters (e.g. ?Region=Arani)
    urlParams.forEach((value, key) => {
        const id = key.toLowerCase() + "Filter";
        const element = document.getElementById(id) || document.getElementById(key + "Filter");
        if(element){
            if(element.tagName === "SELECT"){
                const options = Array.from(element.options).map(o => o.value);
                if(options.includes(value)){
                    element.value = value;
                    hasChanges = true;
                }
            } else if(element.tagName === "INPUT" && element.type === "date"){
                element.value = value;
                hasChanges = true;
            }
        }
    });

    // 2. ThingsBoard-specific filters object (e.g. ?tbFilters={"Region":"Arani"})
    const tbFiltersRaw = urlParams.get("tbFilters");
    if(tbFiltersRaw){
        try {
            const tbFilters = JSON.parse(decodeURIComponent(tbFiltersRaw));
            if(applyTbFilters(tbFilters)){
                hasChanges = true;
            }
        } catch(e) {
            console.error("Error parsing tbFilters URL parameter:", e);
        }
    }

    if(hasChanges){
        applyFilters();
    }

}

/* ==========================================================
APPLY THINGSBOARD POSTMESSAGE FILTERS
========================================================== */

function applyTbFilters(filters){

    if(!filters || typeof filters !== "object") return false;

    let hasChanges = false;

    Object.entries(filters).forEach(([key, val]) => {
        let normalizedKey = key.toLowerCase().trim();
        
        // Map 'customername' or 'customer' to 'customer'
        if(normalizedKey === "customername"){
            normalizedKey = "customer";
        }
        
        const filterId = filterIds[normalizedKey] || normalizedKey + "Filter";
        const element = document.getElementById(filterId) || document.getElementById(key + "Filter");

        if(element){
            const newVal = val || "All";
            if(element.value !== newVal){
                if(element.tagName === "SELECT"){
                    const options = Array.from(element.options).map(o => o.value);
                    if(options.includes(newVal)){
                        element.value = newVal;
                        hasChanges = true;
                    }
                } else {
                    element.value = newVal;
                    hasChanges = true;
                }
            }
        }
    });

    return hasChanges;

}

// Listen to postMessage event from ThingsBoard
window.addEventListener("message", (event) => {
    const data = event.data;
    if(data && data.type === "tbFilters"){
        if(applyTbFilters(data.filters)){
            applyFilters();
        }
    }
});
