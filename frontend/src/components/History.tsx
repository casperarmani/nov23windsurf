import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface HistoryItem {
  id: string;
  timestamp: string;
  content: string;
}

interface HistoryProps {
  items: HistoryItem[];
}

export const History: React.FC<HistoryProps> = ({ items }) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Chat History</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center">No history available</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="border-b pb-2 last:border-0">
                  <p className="text-sm text-muted-foreground">{item.timestamp}</p>
                  <p className="mt-1">{item.content}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
