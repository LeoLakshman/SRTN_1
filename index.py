import matplotlib.pyplot as plt
import pandas as pd

def srtn_simulation(jobs_data, num_cpus):
    """
    Simulates the Shortest Remaining Time Next (SRTN) scheduling algorithm
    with multiple CPUs.

    Args:
        jobs_data (list of dict): A list where each dictionary represents a job
                                    and contains 'job_id', 'arrival_time',
                                    'burst_time', and 'quantum_time'.
        num_cpus (int): The number of CPUs available.

    Returns:
        tuple: A tuple containing:
            - turnaround_times (dict): Turnaround time for each job.
            - average_turnaround_time (float): The average turnaround time.
            - cpu_timeline (dict): A dictionary where keys are CPU IDs and
                                     values are lists of (start_time, end_time, job_id).
            - queue_history (dict): A dictionary where keys are time points and
                                    values are lists of job IDs in the ready queue.
    """
    jobs = sorted([job.copy() for job in jobs_data], key=lambda x: x['arrival_time'])
    num_jobs = len(jobs)
    remaining_time = {job['job_id']: job['burst_time'] for job in jobs}
    start_time = {job['job_id']: -1 for job in jobs}
    completion_time = {job['job_id']: 0 for job in jobs}
    turnaround_time = {job['job_id']: 0 for job in jobs}
    cpu_timeline = {f"CPU {i+1}": [] for i in range(num_cpus)}
    queue_history = {}
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
                    turnaround_time[running_job_id] = completion_time[running_job_id] - jobs_data[jobs_data.index([job for job in jobs_data if job['job_id'] == running_job_id][0])]['arrival_time']
                    cpu_timeline[cpu_id].append((start_time[running_job_id], completion_time[running_job_id], running_job_id))
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
    return turnaround_times, average_turnaround_time, cpu_timeline, queue_history

def visualize_simulation(cpu_timeline, queue_history, turnaround_times, average_turnaround_time):
    """
    Visualizes the CPU timeline and queue history.

    Args:
        cpu_timeline (dict): The CPU timeline data.
        queue_history (dict): The queue history data.
        turnaround_times (dict): Turnaround times for each job.
        average_turnaround_time (float): The average turnaround time.
    """
    fig, axes = plt.subplots(len(cpu_timeline) + 2, 1, figsize=(12, 6 + len(cpu_timeline) * 1.5), sharex=True)
    cpu_axes = list(axes[:-2])
    queue_ax = axes[-2]
    summary_ax = axes[-1]

    # Plot CPU Timeline
    for i, (cpu_id, timeline) in enumerate(cpu_timeline.items()):
        for start, end, job_id in timeline:
            cpu_axes[i].broken_barh([(start, end - start)], [1], facecolors='skyblue', edgecolor='black')
            cpu_axes[i].text((start + end) / 2, 1.5, job_id, ha='center', va='center')
        cpu_axes[i].set_yticks([1])
        cpu_axes[i].set_yticklabels([cpu_id])
        cpu_axes[i].grid(True)
        cpu_axes[i].set_xlim(0, max([end for _, end, _ in [item for sublist in cpu_timeline.values() for item in sublist]] or [1]))

    # Plot Queue History
    queue_ax.step(queue_history.keys(), [", ".join(q) for q in queue_history.values()], where='post')
    queue_ax.set_ylabel("Ready Queue")
    queue_ax.set_yticks([])
    queue_ax.grid(True, axis='x')

    # Display Turnaround Times and Average
    summary_text = "Turnaround Times:\n"
    for job, tt in turnaround_times.items():
        summary_text += f"{job}: {tt}\n"
    summary_text += f"\nAverage Turnaround Time: {average_turnaround_time:.2f}"
    summary_ax.text(0.5, 0.5, summary_text, ha='center', va='center', fontsize=12)
    summary_ax.axis('off')

    plt.xlabel("Time")
    plt.suptitle("SRTN Scheduling Simulation", fontsize=16)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.show()

# Example Usage
if __name__ == "__main__":
    jobs_data = [
        {'job_id': 'j1', 'arrival_time': 0, 'burst_time': 8, 'quantum_time': 4},
        {'job_id': 'j2', 'arrival_time': 1, 'burst_time': 4, 'quantum_time': 4},
        {'job_id': 'j3', 'arrival_time': 2, 'burst_time': 9, 'quantum_time': 4},
        {'job_id': 'j4', 'arrival_time': 3, 'burst_time': 5, 'quantum_time': 4}
    ]
    num_cpus = 2
    turnaround_times, avg_turnaround_time, cpu_timeline, queue_history = srtn_simulation(jobs_data, num_cpus)

    print("Turnaround Times:", turnaround_times)
    print("Average Turnaround Time:", avg_turnaround_time)
    print("CPU Timeline:", cpu_timeline)
    print("Queue History:", queue_history)

    visualize_simulation(cpu_timeline, queue_history, turnaround_times, avg_turnaround_time)

    print("\nEnd of Simulation (Empty Stack)")
