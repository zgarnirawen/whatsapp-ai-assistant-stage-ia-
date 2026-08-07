// Temporary in-memory stubs for To do list / Agenda modules.
// Replace with real API calls once those modules expose stable interfaces.

interface StubTask {
  id: string;
  title: string;
  createdAt: string;
}

interface StubEvent {
  id: string;
  title: string;
  dateTime: string;
  createdAt: string;
}

const tasks: StubTask[] = [];
const events: StubEvent[] = [];

export function createStubTask(title: string): StubTask {
  const task: StubTask = {
    id: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
}

export function createStubEvent(title: string, dateTime: string): StubEvent {
  const event: StubEvent = {
    id: crypto.randomUUID(),
    title,
    dateTime,
    createdAt: new Date().toISOString(),
  };
  events.push(event);
  return event;
}

export function getStubTasks(): StubTask[] {
  return tasks;
}

export function getStubEvents(): StubEvent[] {
  return events;
}
export function getTasksInRange(): StubTask[] {
  // Stub tasks currently have no due date field, so for now return all tasks.
  // Once real Task module exists with due dates, filter properly here.
  return tasks;
}

export function getEventsInRange(startDate: string, endDate: string): StubEvent[] {
  return events.filter((event) => {
    const eventDate = event.dateTime.split('T')[0];
    return eventDate >= startDate && eventDate <= endDate;
  });
}
export function findTasksByTitle(query: string): StubTask[] {
  const lowerQuery = query.toLowerCase();
  return tasks.filter((t) => t.title.toLowerCase().includes(lowerQuery));
}

export function findEventsByTitle(query: string): StubEvent[] {
  const lowerQuery = query.toLowerCase();
  return events.filter((e) => e.title.toLowerCase().includes(lowerQuery));
}

export function deleteStubTask(id: string): boolean {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  return true;
}

export function deleteStubEvent(id: string): boolean {
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return false;
  events.splice(index, 1);
  return true;
}

export function updateStubTask(id: string, newTitle: string): StubTask | null {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.title = newTitle;
  return task;
}

export function updateStubEvent(id: string, newTitle?: string, newDateTime?: string): StubEvent | null {
  const event = events.find((e) => e.id === id);
  if (!event) return null;
  if (newTitle) event.title = newTitle;
  if (newDateTime) event.dateTime = newDateTime;
  return event;
}