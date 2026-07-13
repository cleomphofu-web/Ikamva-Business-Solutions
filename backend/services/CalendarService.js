export class CalendarService {
  async createEvent() {
    throw new Error('CalendarService.createEvent must be implemented by a provider adapter.');
  }

  async listEvents() {
    throw new Error('CalendarService.listEvents must be implemented by a provider adapter.');
  }
}
