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
    const parsedValue = parseFloat(value);
    if (property === 'burstTime' && parsedValue <= 0) {
        alert("Burst time must be greater than zero.");
        // Revert the input field to the previous valid value
        const inputElement = document.querySelectorAll(`#jobTable tr:nth-child(${index + 1}) td:nth-child(3) input`)[0];
        inputElement.value = jobs[index].burstTime;
        return; // Don't update if burst time is zero or negative
    }
    jobs[index][property] = parsedValue;
    if (property === 'burstTime') {
        jobs[index].remainingTime = parsedValue;
    }
}

function calculateSRTN() {
    // Logic for SRTN scheduling
    const cpuCount = parseInt(document.getElementById("cpuCount").value);
    const timeQuantum = parseFloat(document.getElementById("timeQuantum").value); // Changed to parseFloat

    jobs.forEach(job => {
        job.remainingTime = job.burstTime;
        job.startTime = -1.0; // Ensure it's a float
        job.endTime = 0.0;    // Ensure it's a float
        job.turnaroundTime = 0.0;
        job.lastExecutionTime = -1.0;
    });

    let currentTime = 0.0; // Ensure it's a float
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

        if (Math.abs(currentTime % timeQuantum) < 0.0001) { // Using a small tolerance for float comparison
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
                runningJobs[i] = { id: job.id, allocatedTime: 0.0 }; // Ensure it's a float
            }
        }

        // Process each CPU
        for (let i = 0; i < cpuCount; i++) {
            if (runningJobs[i] !== null) {
                let runningJob = runningJobs[i];
                let job = jobs.find(j => j.id === runningJob.id);

                job.remainingTime -= 1.0; // Decrement by 1 unit of time
                runningJob.allocatedTime += 1.0;

                jobHistory.push({
                    jobId: job.id,
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + 1.0
                });

                if (job.remainingTime <= 0.0001) { // Using a small tolerance for float comparison
                    job.endTime = currentTime + 1.0;
                    job.turnaroundTime = job.endTime - job.arrivalTime;
                    completedJobs++;
                    runningJobs[i] = null;
                }
            } else {
                jobHistory.push({
                    jobId: 'idle',
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + 1.0
                });
            }
        }

        currentTime += 1.0; // Increment time by 1 unit
    }

    updateJobTable();
    calculateAverageTurnaroundTime();
    drawGanttChart(jobHistory, jobQueueHistory);
}

function calculateRoundRobin() {
    // Logic for Round Robin scheduling
    const cpuCount = parseInt(document.getElementById("cpuCount").value);
    const timeQuantum = parseFloat(document.getElementById("timeQuantum").value); // Changed to parseFloat

    // Reset job states
    jobs.forEach(job => {
        job.remainingTime = job.burstTime;
        job.startTime = -1.0; // Ensure it's a float
        job.endTime = 0.0;    // Ensure it's a float
        job.turnaroundTime = 0.0;
        job.lastExecutionTime = -1.0;
    });

    let currentTime = 0.0; // Ensure it's a float
    let completedJobs = 0;
    let runningJobs = new Array(cpuCount).fill(null);
    let jobQueue = [];
    let jobHistory = [];
    let jobQueueHistory = [];

    while (completedJobs < jobs.length) {
        // Check for new arrivals
        jobs.forEach(job => {
            if (Math.abs(job.arrivalTime - currentTime) < 0.0001 && !jobQueue.includes(job) && job.remainingTime > 0) { // Using a small tolerance
                jobQueue.push(job);
            }
        });

        if (Math.abs(currentTime % timeQuantum) < 0.0001) { // Using a small tolerance for float comparison
            const jobsToRequeue = [];
            runningJobs.forEach((runningJob, index) => {
                if (runningJob !== null) {
                    let job = jobs.find(j => j.id === runningJob.id);
                    if (job.remainingTime > 0) {
                        jobsToRequeue.push(job);
                    }
                }
            });
            jobQueue.push(...jobsToRequeue);
            runningJobs = runningJobs.map(() => null); // Clear all running jobs

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
                    runningJobs[i] = { id: job.id, allocatedTime: 0.0 }; // Ensure it's a float
                }
            }
        }

        // Process each CPU
        for (let i = 0; i < cpuCount; i++) {
            if (runningJobs[i] !== null) {
                let runningJob = runningJobs[i];
                let job = jobs.find(j => j.id === runningJob.id);

                job.remainingTime -= 1.0; // Decrement by 1 unit of time
                runningJob.allocatedTime += 1.0;

                jobHistory.push({
                    jobId: job.id,
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + 1.0
                });

                if (job.remainingTime <= 0.0001) { // Using a small tolerance for float comparison
                    job.endTime = currentTime + 1.0;
                    job.turnaroundTime = job.endTime - job.arrivalTime;
                    completedJobs++;
                    runningJobs[i] = null;
                }
            } else {
                jobHistory.push({
                    jobId: 'idle',
                    cpuId: i,
                    startTime: currentTime,
                    endTime: currentTime + 1.0
                });
            }
        }

        currentTime += 1.0; // Increment time by 1 unit
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

    const cpuCount = parseInt(document.getElementById("cpuCount").value);
    const timeQuantum = parseFloat(document.getElementById("timeQuantum").value);
    const maxEndTime = Math.max(...jobHistory.map(entry => entry.endTime));

    for (let i = 0; i < cpuCount; i++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "cpu-row";
        ganttChart.appendChild(rowDiv);

        let cpuHistory = jobHistory.filter(entry => entry.cpuId === i).sort((a, b) => a.startTime - b.startTime);

        cpuHistory.forEach(entry => {
            let currentTime = entry.startTime;
            const endTime = entry.endTime;

            while (currentTime < endTime) {
                const blockEndTime = Math.min(currentTime + timeQuantum, endTime);
                const duration = blockEndTime - currentTime;
                const widthPercentage = (duration / maxEndTime) * 100;

                if (widthPercentage > 0) {
                    const jobBlock = document.createElement("div");
                    jobBlock.className = "job-block";
                    jobBlock.style.width = `${widthPercentage}%`;

                    if (entry.jobId === 'idle') {
                        jobBlock.classList.add('idle-block');
                    } else {
                        jobBlock.style.backgroundColor = colors[(entry.jobId - 1) % colors.length];
                        jobBlock.textContent = `J${entry.jobId}`;
                    }
                    rowDiv.appendChild(jobBlock);
                }
                currentTime = blockEndTime;
            }
        });
    }

    // Add time axis
    const timeAxisDiv = document.createElement("div");
    timeAxisDiv.className = "time-axis";
    ganttChart.appendChild(timeAxisDiv);

    for (let t = 0; t <= maxEndTime; t += timeQuantum) {
        const markerDiv = document.createElement("div");
        markerDiv.className = "time-marker";
        markerDiv.style.left = `${(t / maxEndTime * 100)}%`;
        markerDiv.textContent = t.toFixed(1);
        timeAxisDiv.appendChild(markerDiv);

        const lineDiv = document.createElement("div");
        lineDiv.className = "dashed-line";
        lineDiv.style.left = `${(t / maxEndTime * 100)}%`;
        ganttChart.appendChild(lineDiv);

        const queueEntry = jobQueueHistory.find(entry => Math.abs(entry.time - t) < 0.0001);
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

    jobs.forEach(job => {
        if (job.arrivalTime > 0 && job.arrivalTime <= maxEndTime) {
            const arrivalNameDiv = document.createElement("div");
            arrivalNameDiv.className = "job-arrival-name";
            arrivalNameDiv.style.left = `${(job.arrivalTime / maxEndTime * 100)}%`;
            arrivalNameDiv.textContent = `J${job.id}`;
            timeAxisDiv.appendChild(arrivalNameDiv);

            const arrivalTimeDiv = document.createElement("div");
            arrivalTimeDiv.className = "job-arrival";
            arrivalTimeDiv.style.left = `${(job.arrivalTime / maxEndTime * 100)}%`;
            arrivalTimeDiv.textContent = job.arrivalTime.toFixed(1);
            timeAxisDiv.appendChild(arrivalTimeDiv);

            const arrivalLineDiv = document.createElement("div");
            arrivalLineDiv.className = "arrival-line";
            arrivalLineDiv.style.left = `${(job.arrivalTime / maxEndTime * 100)}%`;
            ganttChart.appendChild(arrivalLineDiv);
        }
    });

    const containerHeight = ganttChart.offsetHeight + 100;
    document.getElementById('ganttChartContainer').style.height = `${containerHeight}px`;
}

// Initialize with default jobs
jobs.push({ id: 1, arrivalTime: 0.0, burstTime: 4.0, remainingTime: 4.0, startTime: -1.0, endTime: 0.0, turnaroundTime: 0.0, lastExecutionTime: -1.0 });
jobs.push({ id: 2, arrivalTime: 1.0, burstTime: 2.0, remainingTime: 2.0, startTime: -1.0, endTime: 0.0, turnaroundTime: 0.0, lastExecutionTime: -1.0 });
jobs.push({ id: 3, arrivalTime: 1.0, burstTime: 6.0, remainingTime: 6.0, startTime: -1.0, endTime: 0.0, turnaroundTime: 0.0, lastExecutionTime: -1.0 });
jobs.push({ id: 4, arrivalTime: 2.0, burstTime: 3.0, remainingTime: 1.5, startTime: -1.0, endTime: 0.0, turnaroundTime: 0.0, lastExecutionTime: -1.0 });
updateJobTable();
