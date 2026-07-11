/* ==========================================================
SMART LIGHT TICKET MONITORING SYSTEM
Ticket Table Engine
========================================================== */

let currentPage = 1;

let rowsPerPage = 10;

let currentSortColumn = "";

let currentSortDirection = "asc";

/* ==========================================================
POPULATE TABLE
========================================================== */

function populateTable(){

    const tbody = document.querySelector("#ticketTable tbody");

    tbody.innerHTML = "";

    if(FILTERED_DATA.length===0){

        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="no-data">
                    No Tickets Found
                </td>
            </tr>
        `;

        return;

    }

    const start = (currentPage-1)*rowsPerPage;

    const end = start + rowsPerPage;

    const pageData = FILTERED_DATA.slice(start,end);

    pageData.forEach(ticket=>{

        tbody.appendChild(createRow(ticket));

    });

    renderPagination();

}
/* ==========================================================
CREATE ROW
========================================================== */

function createRow(ticket){

    const tr = document.createElement("tr");

    tr.innerHTML = `

        <td>${value(ticket,
            ["Ticket Number","Ticket No","Ticket","ticket"])}</td>

        <td>${value(ticket,
            ["Region"])}</td>

        <td>${value(ticket,
            ["Zone"])}</td>

        <td>${value(ticket,
            ["Ward"])}</td>

        <td>${value(ticket,
            ["Problem Type","Problem"])}</td>

        <td>
            ${priorityBadge(
                value(ticket,
                ["Priority"])
            )}
        </td>

        <td>
            ${statusBadge(
                value(ticket,
                ["Status"])
            )}
        </td>

        <td>${value(ticket,
            ["Opened Time","Opened"])}</td>

        <td>${calculateResolution(ticket).toFixed(1)} hrs</td>

    `;

    return tr;

}
/* ==========================================================
VALUE HELPER
========================================================== */

function value(ticket,keys){

    for(const key of keys){

        if(ticket[key]!==undefined){

            return ticket[key];

        }

    }

    return "-";

}
/* ==========================================================
PRIORITY BADGE
========================================================== */

function priorityBadge(priority){

    const p=(priority||"").toLowerCase();

    let cls="badge-info";

    if(p.includes("critical")){

        cls="badge-danger";

    }

    else if(p.includes("major")){

        cls="badge-warning";

    }

    else if(p.includes("minor")){

        cls="badge-success";

    }

    return `<span class="badge ${cls}">
            ${priority||"-"}
            </span>`;

}
/* ==========================================================
STATUS BADGE
========================================================== */

function statusBadge(status){

    const s=(status||"").toLowerCase();

    let cls="badge-warning";

    if(
        s.includes("closed") ||
        s.includes("resolved")
    ){

        cls="badge-success";

    }

    return `<span class="badge ${cls}">
            ${status||"-"}
            </span>`;

}
/* ==========================================================
PAGINATION
========================================================== */

function renderPagination(){

    let container=document.getElementById("pagination");

    if(!container) return;

    container.innerHTML="";

    const pages=Math.ceil(
        FILTERED_DATA.length/rowsPerPage
    );

    if (pages <= 1) return;

    const range = 2; // how many pages to show around current page

    // Prev Button
    const prevBtn = document.createElement("button");
    prevBtn.innerText = "Prev";
    prevBtn.className = "pagination-btn";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            populateTable();
        }
    };
    container.appendChild(prevBtn);

    // Page buttons
    for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || (i >= currentPage - range && i <= currentPage + range)) {
            const btn = document.createElement("button");
            btn.innerText = i;
            if (i === currentPage) {
                btn.classList.add("active");
            }
            btn.onclick = () => {
                currentPage = i;
                populateTable();
            };
            container.appendChild(btn);
        } else if (i === 2 || i === pages - 1) {
            const ellipsis = document.createElement("span");
            ellipsis.innerText = "...";
            ellipsis.style.padding = "0 10px";
            ellipsis.style.color = "var(--text-muted)";
            
            if (i === 2 && currentPage - range > 2) {
                container.appendChild(ellipsis);
            } else if (i === pages - 1 && currentPage + range < pages - 1) {
                container.appendChild(ellipsis);
            }
        }
    }

    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.innerText = "Next";
    nextBtn.className = "pagination-btn";
    nextBtn.disabled = currentPage === pages;
    nextBtn.onclick = () => {
        if (currentPage < pages) {
            currentPage++;
            populateTable();
        }
    };
    container.appendChild(nextBtn);

}
/* ==========================================================
TABLE SORTING
========================================================== */

function enableSorting(){

    const headers=document.querySelectorAll(
        "#ticketTable th"
    );

    headers.forEach((header,index)=>{

        header.style.cursor="pointer";

        header.onclick=()=>{

            sortTable(index);

        };

    });

}
/* ==========================================================
SORT TABLE
========================================================== */

function sortTable(index){

    const map=[

        "Ticket Number",

        "Region",

        "Zone",

        "Ward",

        "Problem Type",

        "Priority",

        "Status",

        "Opened Time"

    ];

    const column=map[index];

    if(!column) return;

    if(currentSortColumn===column){

        currentSortDirection=
        currentSortDirection==="asc"
        ?"desc":"asc";

    }

    else{

        currentSortColumn=column;

        currentSortDirection="asc";

    }

    FILTERED_DATA.sort((a,b)=>{

        let x=(a[column]||"").toString();

        let y=(b[column]||"").toString();

        return currentSortDirection==="asc"
            ?x.localeCompare(y)
            :y.localeCompare(x);

    });

    populateTable();

}
/* ==========================================================
INITIALIZE
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    ()=>{

        enableSorting();

    }

);