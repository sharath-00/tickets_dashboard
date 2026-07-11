/* ==========================================================
SMART LIGHT TICKET MONITORING SYSTEM
Dashboard KPI Engine
========================================================== */

/* ==========================================================
CALCULATE ALL KPIs
========================================================== */

function calculateKPIs(){

    const total = FILTERED_DATA.length;

    let open = 0;

    let closed = 0;

    let critical = 0;
    
    let closedTicketDurationsSum = 0;
    let closedWithDurationCount = 0;

    FILTERED_DATA.forEach(ticket=>{

        const status = (ticket.Status || ticket.status || "").toLowerCase();

        const priority = (ticket.Priority || ticket.priority || "").toLowerCase();

        if(
            status.includes("closed") ||
            status.includes("resolved")
        ){
            closed++;
            const duration = parseFloat(ticket["Duration (Days)"]) || parseFloat(ticket.duration) || 0;
            if (duration > 0) {
                closedTicketDurationsSum += duration;
                closedWithDurationCount++;
            } else {
                const resHrs = calculateResolution(ticket);
                if (resHrs > 0) {
                    closedTicketDurationsSum += (resHrs / 24);
                    closedWithDurationCount++;
                }
            }
        }
        else{
            open++;
        }

        if(
            priority.includes("critical")
        ){
            critical++;
        }

    });

    const sla =
        total===0
        ?0
        :((closed/total)*100);

    const avgDuration = closedWithDurationCount === 0 ? 0 : (closedTicketDurationsSum / closedWithDurationCount);
    let mttrText = "0.0h";
    if (avgDuration > 0) {
        if (avgDuration < 1) {
            mttrText = (avgDuration * 24).toFixed(1) + "h";
        } else {
            mttrText = avgDuration.toFixed(1) + "d";
        }
    }

    animateValue(
        "totalTickets",
        total
    );

    animateValue(
        "openTickets",
        open
    );

    animateValue(
        "closedTickets",
        closed
    );

    animateValue(
        "criticalTickets",
        critical
    );

    document.getElementById(
        "slaValue"
    ).innerHTML=
    sla.toFixed(1)+"%";

    const mttrValueElem = document.getElementById("mttrValue");
    if (mttrValueElem) {
        mttrValueElem.textContent = mttrText;
    }

    const mttrProgress = closed === 0 ? 0 : (closedWithDurationCount / closed) * 100;

    updateProgressBars(
        total,
        open,
        closed,
        critical,
        sla,
        mttrProgress
    );

}

/* ==========================================================
CALCULATE RESOLUTION HOURS
========================================================== */

function calculateResolution(ticket){

    const opened =
        ticket["Opened Time"] ||
        ticket.OpenedTime ||
        ticket.opened;

    const closed =
        ticket["Closed Time"] ||
        ticket.ClosedTime ||
        ticket.closed;

    if(!opened || !closed){

        return 0;

    }

    const start = new Date(opened);

    const end = new Date(closed);

    if(isNaN(start)||isNaN(end)){

        return 0;

    }

    return (
        end-start
    )/1000/60/60;

}

/* ==========================================================
PROGRESS BAR UPDATE
========================================================== */

function updateProgressBars(

    total,

    open,

    closed,

    critical,

    sla,
    
    mttrProgress

){

    const fills =
        document.querySelectorAll(".progress-fill");

    if(total===0){

        fills.forEach(bar=>{

            bar.style.width="0%";

        });

        return;

    }

    const values = [
        100,
        (closed/total)*100,
        (open/total)*100,
        (critical/total)*100,
        sla,
        mttrProgress
    ];

    fills.forEach((bar,index)=>{

        if(!bar) return;

        const value = values[index] !== undefined ? values[index] : 0;

        bar.style.width = Math.max(0, Math.min(100, value)) + "%";

    });

}

/* ==========================================================
COUNTER ANIMATION
========================================================== */

function animateValue(

    id,

    end

){

    const element=document.getElementById(id);

    if(!element) return;

    element.textContent="0";

    if(end<=0){

        element.textContent="0";

        return;

    }

    let start=0;

    const duration=800;

    const increment=end/(duration/15);

    const timer=setInterval(()=>{

        start+=increment;

        if(start>=end){

            start=end;

            clearInterval(timer);

        }

        element.textContent=Math.floor(start);

    },15);

}