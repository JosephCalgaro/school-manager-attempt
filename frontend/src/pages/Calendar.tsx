import { useState, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { EventInput, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";

interface CalendarEvent extends EventInput {
  extendedProps: { calendar: string };
}

const eventTypes: Record<string, { label: string; color: string }> = {
  Prova:      { label: "Prova / Avaliação", color: "#ef4444" },
  Atividade:  { label: "Atividade",          color: "#f97316" },
  Aula:       { label: "Aula Especial",      color: "#3b82f6" },
  Evento:     { label: "Evento Escolar",     color: "#8b5cf6" },
  Feriado:    { label: "Feriado / Recesso",  color: "#6b7280" },
};

const Calendar: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventType, setEventType] = useState("Aula");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const calendarRef = useRef<FullCalendar>(null);
  const { isOpen, openModal, closeModal } = useModal();

  const handleDateSelect = (info: DateSelectArg) => {
    resetFields();
    setEventStartDate(info.startStr);
    setEventEndDate(info.endStr || info.startStr);
    openModal();
  };

  const handleEventClick = (info: EventClickArg) => {
    const ev = info.event;
    setSelectedEvent(ev as unknown as CalendarEvent);
    setEventTitle(ev.title);
    setEventStartDate(ev.start?.toISOString().split("T")[0] || "");
    setEventEndDate(ev.end?.toISOString().split("T")[0] || "");
    setEventType(ev.extendedProps.calendar);
    openModal();
  };

  const handleSave = () => {
    if (!eventTitle.trim()) return;
    const color = eventTypes[eventType]?.color ?? "#3b82f6";
    if (selectedEvent) {
      setEvents(prev => prev.map(e =>
        e.id === selectedEvent.id
          ? { ...e, title: eventTitle, start: eventStartDate, end: eventEndDate, backgroundColor: color, borderColor: color, extendedProps: { calendar: eventType } }
          : e
      ));
    } else {
      setEvents(prev => [...prev, {
        id: Date.now().toString(), title: eventTitle,
        start: eventStartDate, end: eventEndDate, allDay: true,
        backgroundColor: color, borderColor: color,
        extendedProps: { calendar: eventType },
      }]);
    }
    closeModal(); resetFields();
  };

  const handleDelete = () => {
    if (selectedEvent) setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
    closeModal(); resetFields();
  };

  const resetFields = () => {
    setEventTitle(""); setEventStartDate(""); setEventEndDate("");
    setEventType("Aula"); setSelectedEvent(null);
  };

  return (
    <>
      <PageMeta title="Calendário | Escola" description="Calendário escolar de eventos e atividades" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="custom-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={ptBrLocale}
            initialView="dayGridMonth"
            headerToolbar={{ left: "prev,next addEventButton", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            events={events}
            selectable={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventContent={(info) => (
              <div className="flex items-center gap-1 px-1 py-0.5 text-xs font-medium text-white truncate">
                <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-white/70" />
                {info.event.title}
              </div>
            )}
            customButtons={{ addEventButton: { text: "+ Evento", click: () => { resetFields(); openModal(); } } }}
          />
        </div>

        <Modal isOpen={isOpen} onClose={closeModal} className="max-w-lg p-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h5 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                {selectedEvent ? "Editar Evento" : "Novo Evento"}
              </h5>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"/></svg>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Título *</label>
              <input
                type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)}
                placeholder="Ex: Prova de Teoria Musical"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">Tipo de Evento</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(eventTypes).map(([key, { label, color }]) => (
                  <button key={key} type="button" onClick={() => setEventType(key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border-2 transition-all ${eventType === key ? "text-white" : "bg-transparent text-gray-600 dark:text-gray-400"}`}
                    style={eventType === key ? { backgroundColor: color, borderColor: color } : { borderColor: color, color }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Data início</label>
                <input type="date" value={eventStartDate} onChange={e => setEventStartDate(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Data fim</label>
                <input type="date" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
              {selectedEvent && (
                <button onClick={handleDelete} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">
                  Excluir
                </button>
              )}
              <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!eventTitle.trim()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {selectedEvent ? "Salvar" : "Criar Evento"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default Calendar;
