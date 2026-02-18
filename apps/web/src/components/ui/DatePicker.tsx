"use client";

import { useState, useRef, useEffect } from "react";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    isAfter,
    isBefore,
    parseISO
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

type DatePickerProps = {
    value: string;
    onChange: (date: string) => void;
    label?: string;
};

export function DatePicker({ value, onChange, label }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? parseISO(value) : null;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                <span className="text-xs font-black uppercase tracking-widest text-slate-900">
                    {format(currentMonth, "MMMM yyyy")}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        const dateNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-2">
                    {dateNames[i]}
                </div>
            );
        }

        return <div className="grid grid-cols-7 border-b border-slate-50">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, "d");
                const cloneDay = day;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isDisabled = isAfter(day, new Date());

                days.push(
                    <div
                        key={day.toString()}
                        className={`flex h-10 w-full items-center justify-center text-[11px] font-bold transition-all relative
              ${!isCurrentMonth ? "text-slate-200" : "text-slate-600"}
              ${isDisabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-slate-50"}
            `}
                        onClick={() => {
                            if (!isDisabled) {
                                onChange(format(cloneDay, "yyyy-MM-dd"));
                                setIsOpen(false);
                            }
                        }}
                    >
                        {isSelected && (
                            <div className="absolute inset-1.5 rounded-xl bg-brand-600 shadow-lg shadow-brand-500/30 animate-in zoom-in-50 duration-200" />
                        )}
                        <span className={`relative z-10 ${isSelected ? "text-white" : ""}`}>
                            {formattedDate}
                        </span>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="p-1">{rows}</div>;
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all
          ${isOpen ? "border-brand-500 ring-4 ring-brand-500/10" : "border-slate-100 hover:border-slate-200"}
          text-slate-900
        `}
            >
                <CalendarIcon size={16} className={isOpen ? "text-brand-500" : "text-slate-400"} />
                {value ? format(parseISO(value), "MMM dd, yyyy") : "Select Date"}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 mt-2 w-72 overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-2xl shadow-slate-200/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    {renderHeader()}
                    {renderDays()}
                    {renderCells()}
                </div>
            )}
        </div>
    );
}
