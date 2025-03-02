'use client';

import { Inbox } from '@novu/react';
import { useRouter } from 'next/navigation';

export function NovuInbox() {
    const router = useRouter();

    return (
        <Inbox
            applicationIdentifier="_EYlz4GL3-nL"
            subscriberId="subscriberId"
            routerPush={(path: string) => router.push(path)}
        />
    );
}