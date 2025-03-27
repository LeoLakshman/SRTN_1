from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for local development

def srtn_simulation(jobs_data, num_cpus):
    # (The SRTN simulation logic from the previous Python code goes here)
    jobs = sorted([job.copy() for job in jobs_data], key=lambda x: x['arrival_time'])
    num_jobs = len(jobs)
    remaining_time = {job['job_id']: job['burst_time'] for job in jobs}
    start_time = {job['job_id']: -1 for job in jobs}
    completion_time = {job['job_id']: 0 for job in jobs}
    turnaround_time = {job['job_id']: 0 for job in jobs}
    cpu_timeline = {f"CPU {i+1}": [] for i in range(num_cpus)}
    queue_history = {}
    completed_stack = []
    current_time = 0
    completed_jobs = 0
    cpu_assignment = {f"CPU {i+1}": None for i in range(num_cpus)}
    ready_queue = []

    while completed_jobs < num_jobs:
        # Add newly arrived jobs to the ready queue
        for job in jobs:
            if job['job_id'] not in [q['job_id'] for q in ready_queue] and \
               completion_time[job['job_id']] == 0 and \
               job['arrival_time'] <= current_time:
                ready_queue.append(job)

        # Sort the ready queue by remaining time
        ready_queue.sort(key=lambda x: remaining_time[x['job_id']])
        queue_history[current_time] = [job['job_id'] for job in ready_queue]

        # Assign jobs to available CPUs
        for cpu_id in cpu_assignment:
            if cpu_assignment[cpu_id] is None and ready_queue:
                next_job = ready_queue.pop(0)
                cpu_assignment[cpu_id] = next_job['job_id']
                if start_time[next_job['job_id']] == -1:
                    start_time[next_job['job_id']] = current_time

        # Execute jobs on CPUs
        for cpu_id, running_job_id in cpu_assignment.items():
            if running_job_id:
                remaining_time[running_job_id] -= 1
                if remaining_time[running_job_id] == 0:
                    completion_time[running_job_id] = current_time + 1
                    turnaround_time[running_job_id] = completion_time[running_job_id] - [job for job in jobs_data if job['job_id'] == running_job_id][0]['arrival_time']
                    cpu_timeline[cpu_id].append((start_time[running_job_id], completion_time[running_job_id], running_job_id))
                    completed_stack.append(running_job_id)
                    cpu_assignment[cpu_id] = None
                    completed_jobs += 1
                else:
                    # Check for preemption
                    next_shortest_job = None
                    if ready_queue:
                        next_shortest_job = ready_queue[0]
                        if remaining_time[next_shortest_job['job_id']] < remaining_time[running_job_id]:
                            # Preempt the current job
                            preempted_job_id = running_job_id
                            cpu_assignment[cpu_id] = None
                            ready_queue.insert(0, [job for job in jobs if job['job_id'] == preempted_job_id][0])
                            ready_queue.sort(key=lambda x: remaining_time[x['job_id']])
                            queue_history[current_time + 1] = [job['job_id'] for job in ready_queue]
                            break # Move to the next time step to re-evaluate CPU assignments

        current_time += 1

        # Break the loop if no more jobs are running or in the ready queue
        if all(job is None for job in cpu_assignment.values()) and not ready_queue and completed_jobs == num_jobs:
            break

    average_turnaround_time = sum(turnaround_time.values()) / num_jobs if num_jobs > 0 else 0
    return {
        'turnaround_times': turnaround_time,
        'average_turnaround_time': average_turnaround_time,
        'cpu_timeline': cpu_timeline,
        'queue_history': queue_history,
        'completed_stack': completed_stack
    }

@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.get_json()
    num_cpus = data['num_cpus']
    jobs_data = data['jobs_data']
    results = srtn_simulation(jobs_data, num_cpus)
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
