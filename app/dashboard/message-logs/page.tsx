"use client";

import { Suspense } from "react";
import { MessageLogsContent } from "@/components/dashboard/message-logs-content";
import MessageLogsLoading from "./loading";

export default function MessageLogsPage() {
    return (
        <Suspense fallback={<MessageLogsLoading />}>
            <MessageLogsContent />
        </Suspense>
    );
}
