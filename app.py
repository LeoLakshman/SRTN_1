document.addEventListener('DOMContentLoaded', () => {
    const numCpusInput = document.getElementById('num_cpus');
    const numJobsInput = document.getElementById('num_jobs');
    const generateJobsButton = document.getElementById('generate_jobs');
    const jobInputsDiv = document.getElementById('job_inputs');
    const quantumConstantInput = document.getElementById('quantum_constant');
    const startSimulationButton = document.getElementById('start_simulation');
    const turnaroundTimesDiv = document.getElementById('turnaround_times');
    const averageTurnaroundTimeDiv = document.getElementById('average_turnaround_time');
    const cpuTimelineChartDiv = document.getElementById('cpu_timeline_chart');
    const queueHistoryDiv = document.getElementById('queue_history');
    const completedStackDiv = document.getElementById('completed_stack');
    const emptyStackMessageDiv = document.getElementById('empty_stack_message');
    let jobCount = 0;

    generateJobsButton.addEventListener('click', () => {
        jobCount = parseInt(numJobsInput.value);
        jobInputsDiv.innerHTML = '';
        for (let i = 1; i <= jobCount; i++) {
            const jobDiv = document.createElement('div');
            jobDiv.innerHTML = `
                <h3>Job j${i}</h3>
                <label for="burst_time_${i}">Burst Time:</label>
                <input type="number" id="burst_time_${i}" value="5" min="1">
                <label for="arrival_time_${i}">Arrival Time:</label>
                <input type="number" id="arrival_time_${i}" value="0" min="0">
            `;
            jobInputsDiv.appendChild(jobDiv);
        }
    });

    startSimulationButton.addEventListener('click', async () => {
        if (jobCount === 0) {
            alert('Please generate job inputs first.');
            return;
        }

        const num_cpus = parseInt(numCpusInput.value);
        const quantum_constant = parseInt(quantumConstantInput.value);
        const jobs_data = [];
        for (let i = 1; i <= jobCount; i++) {
            const burst_time = parseInt(document.getElementById(`burst_time_${i}`).value);
            const arrival_time = parseInt(document.getElementById(`arrival_time_${i}`).value);
            jobs_data.push({
                job_id: `j${i}`,
                arrival_time: arrival_time,
                burst_time: burst_time,
                quantum_time: quantum_constant // Sending quantum constant
            });
        }

        const dataToSend = {
            num_cpus: num_cpus,
            jobs_data: jobs_data
        };

        try {
            const response = await fetch('/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            displayResults(results);

        } catch (error) {
            console.error('Error during simulation:', error);
            alert('Failed to start simulation. Check the console for details.');
        }
    });

    function displayResults(results) {
        turnaroundTimesDiv.innerHTML = '<h3>Turnaround Times:</h3>';
        for (const job_id in results.turnaround_times) {
            turnaroundTimesDiv.innerHTML += `<p>${job_id}: ${results.turnaround_times[job_id]}</p>`;
        }

        averageTurnaroundTimeDiv.innerHTML = `<h3>Average Turnaround Time:</h3><p>${results.average_turnaround_time.toFixed(2)}</p>`;

        // Display CPU Timeline Chart using Chart.js
        const cpuTimelineData = results.cpu_timeline;
        const datasets = [];
        let maxEndTime = 0;

        for (const cpu_id in cpuTimelineData) {
            cpuTimelineData[cpu_id].forEach(task => {
                const startTime = task[0];
                const endTime = task[1];
                const jobId = task[2];
                maxEndTime = Math.max(maxEndTime, endTime);
                datasets.push({
                    label: jobId,
                    data: [{
                        x: [startTime, endTime],
                        y: cpu_id
                    }],
                    borderColor: getRandomColor(),
                    backgroundColor: getRandomColor(),
                    borderWidth: 1
                });
            });
        }

        const chartData = {
            datasets: datasets
        };

        const ctx = document.createElement('canvas');
        cpuTimelineChartDiv.innerHTML = ''; // Clear previous chart
        cpuTimelineChartDiv.appendChild(ctx);

        new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                indexAxis: 'y',
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        min: 0,
                        max: maxEndTime + 1
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'CPU'
                        },
                        ticks: {
                            beginAtZero: true
                        }
                    }
                },
                plugins: {
                    title: {
                        display: false,
                        text: 'CPU Timeline'
                    },
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const datasetLabel = context.dataset.label || '';
                                const value = context.parsed.x;
                                return `${datasetLabel}: ${value[0]} - ${value[1]}`;
                            }
                        }
                    }
                }
            }
        });

        queueHistoryDiv.innerHTML = '<h3>Ready Queue History:</h3>';
        for (const time in results.queue_history) {
            queueHistoryDiv.innerHTML += `<p>Time ${time}: ${results.queue_history[time].join(', ') || 'Empty'}</p>`;
        }

        completedStackDiv.innerHTML = '<h3>Completed Stack:</h3>';
        results.completed_stack.forEach(jobId => {
            completedStackDiv.innerHTML += `<p>${jobId}</p>`;
        });

        if (results.completed_stack.length === jobCount) {
            emptyStackMessageDiv.style.display = 'block';
        } else {
            emptyStackMessageDiv.style.display = 'none';
        }
    }

    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
});
