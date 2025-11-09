
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    groundingChunks?: any[];
}
