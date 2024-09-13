import { getIndexedDBData } from '../storage';
import { formatDate } from '../utils';

function fetchAllCalendarData() {
    return getIndexedDBData('Calendar', 'event2').catch(error => {
        console.log("Error fetchAllCalendarData:", error);
        throw error;
    });
}

export const transformCalendar = (startTime: number, enableCalendar: boolean) => {
    if (!enableCalendar) {
        return Promise.resolve([]);
    }

    return fetchAllCalendarData().then((inputData) => {
        const calendar = inputData.filter((item: any) => {
            const isInTimeRang = new Date(item.startTime) >= new Date(startTime) && new Date(item.startTime) <= new Date(Date.now());
            const isAccept = item.responseStatus === 'Accepted';
            const cancelled = item.cancelled;
            return isInTimeRang && isAccept && !cancelled;
        }).map((item: any) => {
            const data = {
                id: item.id,
                type: 'calendar',
                subject: item.subject,
                description: item.description,
                // @ts-ignore
                time: formatDate(new Date(item.startTime)),
                // @ts-ignore
                startTime: formatDate(new Date(item.startTime)),
                // @ts-ignore
                endTime: formatDate(new Date(item.endTime)),
                // @ts-ignore
                attendees: item.attendees.filter(attendee => attendee.responseStatus === 'Accepted').map(attendee => attendee.name).join(', '),
                organizer: item.organizer.name
            };

            const text = `id:${data.id}\n type:${data.type}\n subject:${data.subject}\n description:${data.description}\n startTime:${data.startTime}\n endTime:${data.endTime}\n attendees:${data.attendees}\n organizer:${data.organizer}`;

            return {
                id: item.id,
                text: text,
                type: 'calendar',
                time: data.time
            };
        });

        return calendar;
    });
}