/* ==========================================================
SMART LIGHT TICKET MONITORING SYSTEM
Filter Engine
========================================================== */

const filterIds = {

    region: "regionFilter",

    zone: "zoneFilter",

    ward: "wardFilter",

    priority: "priorityFilter"

};

// Track selected filters for button-based filters
let selectedStatuses = new Set();

let selectedTicketStates = new Set(["All"]);

/* ==========================================================
LOAD FILTERS
========================================================== */

function loadFilters(){

    loadDropdown(

        filterIds.region,

        findColumn(["Region","region"]),

        RAW_DATA

    );

    updateCascadingDropdowns();

    loadDropdown(

        filterIds.priority,

        findColumn(["Priority","priority"]),

        RAW_DATA

    );

    loadStatusButtons(findColumn(["Status","status"]));

    if(!filtersInitialized){

        initializeFilterEvents();

        filtersInitialized = true;

    }

}

/* ==========================================================
LOAD CASCADING DROPDOWNS
========================================================== */

function updateCascadingDropdowns(){

    const regionColumn = findColumn(["Region","region"]);
    const zoneColumn = findColumn(["Zone","zone"]);
    const wardColumn = findColumn(["Ward","ward"]);

    const regionSelect = document.getElementById(filterIds.region);
    const selectedRegion = regionSelect ? regionSelect.value : "All";

    // 1. Filter records for Zone dropdown based on selected Region
    let zoneRecords = RAW_DATA;
    if(selectedRegion !== "All" && regionColumn){
        zoneRecords = RAW_DATA.filter(r=>r[regionColumn]===selectedRegion);
    }
    loadDropdown(filterIds.zone, zoneColumn, zoneRecords);

    // Get current zone selection after reloading (which might have reset to "All" if invalid)
    const zoneSelect = document.getElementById(filterIds.zone);
    const selectedZone = zoneSelect ? zoneSelect.value : "All";

    // 2. Filter records for Ward dropdown based on selected Region AND Zone
    let wardRecords = zoneRecords;
    if(selectedZone !== "All" && zoneColumn){
        wardRecords = zoneRecords.filter(r=>r[zoneColumn]===selectedZone);
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

    // Initialize dropdown filters
    Object.values(filterIds).forEach(id=>{

        const element = document.getElementById(id);

        if(element){

            element.addEventListener("change", applyFilters);

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

    // Initialize search box
    const searchBox = document.getElementById("ticketSearch");

    if(searchBox){

        searchBox.addEventListener("keyup", applyFilters);

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

            matchesMultiSelectStatus(ticket)

            &&

            matchesMultiSelectTicketState(ticket)

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

    return ticket[column]===selected;

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
SEARCH
========================================================== */

function searchMatch(ticket){

    const keyword=document

        .getElementById("ticketSearch")

        .value

        .toLowerCase()

        .trim();

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
