// script.js
let jobs = [];
const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F67280', '#C06C84'];

function addJob() {
    const newJob = {
        id: jobs.length + 1,
        arrivalTime: 0.0,
        burstTime: 0.0,
        remainingTime: 0.0,
        startTime: -1.0,
        endTime: 0.0,
        turnaroundTime: 0.0,
        lastExecutionTime: -1.0
    };
    jobs.push(newJob);
    updateJobTable();
}

function removeLastJob() {
    if (jobs.length > 0) {
        jobs.pop();
        updateJobTable();
    }
}

function updateJobTable() {
    const tableBody = document.querySelector("#jobTable");
    tableBody.innerHTML = '';
    jobs.forEach((job, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>J${job.id}</td>
            <td><input type="number" class="form-control" step="0.1" value="${job.arrivalTime}" min="0" onchange="updateJobProperty(${index}, 'arrivalTime', this.value)"></td>
            <td><input type="number" class="form-control" step="0.1" value="${job.burstTime}" min="0.1" onchange="updateJobProperty(${index}, 'burstTime', this.value)"></td>
            <td>${job.startTime === -1 ? '-' : job.startTime.toFixed(1)}</td>
            <td>${job.endTime.toFixed(1)}</td>
            <td>${job.turnaroundTime.toFixed(1)}</td>`;
        tableBody.appendChild(row);
    });
}

function updateJobProperty(index, property, value) {
    jobs[index][property] = parseFloat(value);
    if (property === 'burstTime') {
        jobs[index].remainingTime = parseFloat(value);
    }
}

function calculateSRTN() {
    const cpuCount = parseInt(document.getElementById("cpuCount").value);
    const timeQuantum = parseFloat(document.getElementById("timeQuantum").value);

    jobs.forEach(job => {
        job.remainingTime = job.burstTime;
        job.startTime = -1;
        job.endTime = 0;
        job.turnaroundTime = 0;
        job.lastExecutionTime = -1;
    });

    let currentTime = 0;
    let completedJobs = 0;
    let runningJobs = new Array(cpuCount).fill(null);
    let jobHistory = [];
    let jobQueueHistory = [];

    while (completedJobs < jobs.length) {
        // Get all available jobs, including those currently running that need to be considered
        let availableJobs = jobs.filter(job =>
            job.arrivalTime <= currentTime &&
            job.remainingTime > 0
        ).sort((a, b) => a.remainingTime - b.remainingTime || a.arrivalTime - b.arrivalTime);

        if (currentTime % timeQuantum === 0) {
            // Store queue state for visualization
            jobQueueHistory.push({
                time: currentTime,
                jobs: availableJobs.filter(job =>
                    !runningJobs.some(rj => rj && rj.id === job.id)
                ).map(job => ({
                    id: job.id,
                    remainingTime: job.remainingTime
                }))
            });

            // Reassign CPUs based on shortest remaining time
            runningJobs = runningJobs.map(() => null);
            for (let i = 0; i < Math.min(cpuCount, availableJobs.length); i++) {
                let job = availableJobs[i];
                if (job.startTime === -1) {
                    job.startTime = currentTime;
                }
                runningJobs[i] = { id: job.id, allocatedTime: 0 };
            }
        }

        // Process each CPU
        for (let i = 0; i < cpuCount; i++) {
            if (runningJobs[i] !== null) {
                let runningJob = runningJobs[i];
                let job = jobs.find(j => j.id === runningJob.id);

                job.remainingTime -= 1 / timeQuantum; // Decrement by a fraction of time quantum
                runningJob.allocatedTime++;

                jobHistory.push({
                    jobId: job.id,
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + (1 / timeQuantum)
                });

                if (job.remainingTime <= 0) {
                    job.endTime = currentTime + (1 / timeQuantum);
                    job.turnaroundTime = job.endTime - job.arrivalTime;
                    completedJobs++;
                    runningJobs[i] = null;
                }
            } else {
                jobHistory.push({
                    jobId: 'idle',
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + (1 / timeQuantum)
                });
            }
        }

        currentTime += (1 / timeQuantum);
    }

    updateJobTable();
    calculateAverageTurnaroundTime();
    drawGanttChart(jobHistory, jobQueueHistory);
}

function calculateRoundRobin() {
    const cpuCount = parseInt(document.getElementById("cpuCount").value);
    const timeQuantum = parseFloat(document.getElementById("timeQuantum").value);

    // Reset job states
    jobs.forEach(job => {
        job.remainingTime = job.burstTime;
        job.startTime = -1;
        job.endTime = 0;
        job.turnaroundTime = 0;
        job.lastExecutionTime = -1;
    });

    let currentTime = 0;
    let completedJobs = 0;
    let runningJobs = new Array(cpuCount).fill(null);
    let jobQueue = [];
    let jobHistory = [];
    let jobQueueHistory = [];

    while (completedJobs < jobs.length) {
        // Check for new arrivals
        jobs.forEach(job => {
            if (job.arrivalTime <= currentTime && !jobQueue.includes(job) && job.remainingTime > 0) {
                jobQueue.push(job);
            }
        });

        if (currentTime % timeQuantum === 0) {
            // Return running jobs to queue if they're not finished
            runningJobs.forEach((runningJob, index) => {
                if (runningJob !== null) {
                    let job = jobs.find(j => j.id === runningJob.id);
                    if (job.remainingTime > 0) {
                        jobQueue.push(job);
                    }
                    runningJobs[index] = null;
                }
            });

            // Record queue state for visualization
            jobQueueHistory.push({
                time: currentTime,
                jobs: jobQueue.map(job => ({
                    id: job.id,
                    remainingTime: job.remainingTime
                }))
            });

            // Assign jobs to available CPUs
            for (let i = 0; i < cpuCount && jobQueue.length > 0; i++) {
                if (runningJobs[i] === null) {
                    let job = jobQueue.shift();
                    if (job.startTime === -1) {
                        job.startTime = currentTime;
                    }
                    runningJobs[i] = { id: job.id, allocatedTime: 0 };
                }
            }
        }

        // Process each CPU
        for (let i = 0; i < cpuCount; i++) {
            if (runningJobs[i] !== null) {
                let runningJob = runningJobs[i];
                let job = jobs.find(j => j.id === runningJob.id);

                job.remainingTime -= 1 / timeQuantum; // Decrement by a fraction of time quantum
                runningJob.allocatedTime++;

                jobHistory.push({
                    jobId: job.id,
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + (1 / timeQuantum)
                });

                if (job.remainingTime <= 0) {
                    job.endTime = currentTime + (1 / timeQuantum);
                    job.turnaroundTime = job.endTime - job.arrivalTime;
                    completedJobs++;
                    runningJobs[i] = null;
                }
            } else {
                jobHistory.push({
                    jobId: 'idle',
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + (1 / timeQuantum)
                });
            }
        }

        currentTime += (1 / timeQuantum);
    }

    updateJobTable();
    calculateAverageTurnaroundTime();
    drawGanttChart(jobHistory, jobQueueHistory);
}

function calculateAverageTurnaroundTime() {
    const turnaroundTimes = jobs.map(job => job.turnaroundTime);
    const totalTurnaroundTime = turnaroundTimes.reduce((sum, time) => sum + time, 0.0);
    const averageTurnaroundTime = totalTurnaroundTime / jobs.length;

    const calculation = turnaroundTimes.map(t => t.toFixed(1)).join(' + ');
    const result = averageTurnaroundTime.toFixed(2);

    document.getElementById("averageTurnaroundTime").innerHTML = `
        Average Turnaround Time: (${calculation}) / ${jobs.length} = <b>${result}</b>
    `;
}

function drawGanttChart(jobHistory, jobQueueHistory) {
    const ganttChart = document.getElementById("ganttChart");
    ganttChart.innerHTML = '';

    const maxEndTime = Math.max(...jobHistory.map(entry => entry.endTime));
    const timeQuantum = parseFloat(document.getElementById("timeQuantum").value);
    const chartScale = 100; // Adjust for better visualization, e.g., 100px per time unit

    // Draw CPU rows
    for (let i = 0; i < parseInt(document.getElementById("cpuCount").value); i++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "cpu-row";
        ganttChart.appendChild(rowDiv);

        let currentJobId = null;
        let currentBlock = null;
        let blockStartTime = null;

        jobHistory.filter(entry => entry.cpuId === i).forEach((entry, index) => {
            const blockWidth = (entry.endTime - entry.startTime) * chartScale;
            const blockLeft = entry.startTime * chartScale;

            if (entry.jobId !== currentJobId) {
                if (currentBlock) {
                    currentBlock.style.width = `${(entry.startTime - blockStartTime) * chartScale}px`;
                    currentBlock.style.left = `${blockStartTime * chartScale}px`;
                    rowDiv.appendChild(currentBlock);
                }

                currentJobId = entry.jobId;
                blockStartTime = entry.startTime;

                currentBlock = document.createElement("div");
                currentBlock.className = "job-block";
                currentBlock.style.left = `${blockLeft}px`;
                currentBlock.style.width = `${blockWidth}px`;
                if (entry.jobId === 'idle') {
                    currentBlock.classList.add('idle-block');
                    currentBlock.textContent = '';
                } else {
                    currentBlock.style.backgroundColor = colors[(parseInt(entry.jobId.replace('J', '')) - 1) % colors.length];
                    currentBlock.textContent = entry.jobId;
                }
                rowDiv.appendChild(currentBlock);
            } else {
                currentBlock.style.width = `${parseFloat(currentBlock.style.width) + blockWidth}px`;
            }
        });
        // Handle the last block
        if (currentBlock) {
            currentBlock.style.width = `${(maxEndTime - blockStartTime) * chartScale}px`;
            currentBlock.style.left = `${blockStartTime * chartScale}px`;
            rowDiv.appendChild(currentBlock);
        }
    }

    // Add time axis
    const timeAxisDiv = document.createElement("div");
    timeAxisDiv.className = "time-axis";
    ganttChart.appendChild(timeAxisDiv);

    // Add time markers and job queues at time quantum intervals
    for (let t = 0; t <= maxEndTime; t += timeQuantum) {
        // Add time marker
        const markerDiv = document.createElement("div");
        markerDiv.className = "time-marker";
        markerDiv.style.left = `${(t / maxEndTime * 100)}%`;
        markerDiv.textContent = t.toFixed(1);
        timeAxisDiv.appendChild(markerDiv);

        // Add vertical time line
        const lineDiv = document.createElement("div");
        lineDiv.className = "dashed-line";
        lineDiv.style.left = `${(t / maxEndTime * 100)}%`;
        ganttChart.appendChild(lineDiv);

        // Add job queue information
        const queueEntry = jobQueueHistory.find(entry => entry.time.toFixed(2) === t.toFixed(2));
        if (queueEntry) {
            const queueDiv = document.createElement("div");
            queueDiv.className = "queue-container";
            queueDiv.style.left = `${(t / maxEndTime * 100)}%`;
            queueDiv.style.top = `${timeAxisDiv.offsetTop + 60}px`;

            const queueJobsDiv = document.createElement("div");
            queueJobsDiv.className = "queue-jobs";
            if (queueEntry.jobs.length > 0) {
                queueJobsDiv.innerHTML = queueEntry.jobs.map(job =>
                    `J${job.id} = ${job.remainingTime.toFixed(1)}`
                ).join('<br>');
            } else {
                queueJobsDiv.innerHTML = "{ }";
            }
            queueDiv.appendChild(queueJobsDiv);
            ganttChart.appendChild(queueDiv);
        }
    }

    // Add job arrival markers
    jobs.forEach(job => {
        if (job.arrivalTime > 0 && job.arrivalTime <= maxEndTime) {
            // Add job name marker
            const arrivalNameDiv = document.createElement("div");
            arrivalNameDiv.className = "job-arrival-name";
            arrivalNameDiv.style.left = `${(job.arrivalTime / maxEndTime * 100)}%`;
            arrivalNameDiv.textContent = `J${job.id}`;
            timeAxisDiv.appendChild(arrivalNameDiv);

            // Add arrival time marker
            const arrivalTimeDiv = document.createElement("div");
            arrivalTimeDiv.className = "job-arrival";
            arrivalTimeDiv.style.left = `${(job.arrivalTime / maxEndTime * 100)}%`;
            arrivalTimeDiv.textContent = job.arrivalTime.toFixed(1);
            timeAxisDiv.appendChild(arrivalTimeDiv);

            // Add arrival vertical line
            const arrivalLineDiv = document.createElement("div");
            arrivalLineDiv.className = "arrival-line";
            arrivalLineDiv.style.left = `${(job.arrivalTime / maxEndTime * 100)}%`;
            ganttChart.appendChild(arrivalLineDiv);
        }
    });

    // Adjust container width and height
    const chartWidth = maxEndTime * chartScale;
    document.getElementById('ganttChartContainer').style.width = `${chartWidth}px`;
    const containerHeight = ganttChart.offsetHeight + 100;
    document.getElementById('ganttChartContainer').style.height = `${containerHeight}px`;
}

// Initialize with sample jobs
addJob();
addJob();
addJob();
updateJobTable();
