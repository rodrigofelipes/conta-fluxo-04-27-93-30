const KEY_PREFIX = "cc_client_box_";

export type DocEntry = {
  id: string;
  name: string;
  size: number;
  category: string;
  ref: string;
  createdAt: number;
};

export type RequestEntry = {
  id: string;
  category: string;
  ref: string;
  note?: string;
  createdAt: number;
  status: "PENDENTE" | "ATENDIDO";
};

export type ClientBox = {
  received: DocEntry[]; // files sent by client to admin
  sent: DocEntry[];     // files sent by admin to client
  requests: RequestEntry[];
};

function key(clientId: string) {
  return `${KEY_PREFIX}${clientId}`;
}

export function getBox(clientId: string): ClientBox {
  const raw = localStorage.getItem(key(clientId));
  if (raw) return JSON.parse(raw) as ClientBox;
  const seed: ClientBox = {
    received: [],
    sent: [],
    requests: [],
  };
  localStorage.setItem(key(clientId), JSON.stringify(seed));
  return seed;
}

function saveBox(clientId: string, box: ClientBox) {
  localStorage.setItem(key(clientId), JSON.stringify(box));
}

export function addRequest(clientId: string, input: { category: string; ref: string; note?: string }) {
  const box = getBox(clientId);
  const req: RequestEntry = {
    id: `rq_${Date.now()}`,
    category: input.category,
    ref: input.ref,
    note: input.note,
    createdAt: Date.now(),
    status: "PENDENTE",
  };
  const next = { ...box, requests: [req, ...box.requests] };
  saveBox(clientId, next);
  return next;
}

export async function addSent(clientId: string, file: File, meta: { category: string; ref: string }) {
  const box = getBox(clientId);
  const doc: DocEntry = {
    id: `s_${Date.now()}`,
    name: file.name,
    size: file.size,
    category: meta.category || "Outros",
    ref: meta.ref || "-",
    createdAt: Date.now(),
  };
  const next = { ...box, sent: [doc, ...box.sent] };
  saveBox(clientId, next);
  return next;
}

export function addReceived(clientId: string, doc: Omit<DocEntry, "id" | "createdAt">) {
  const box = getBox(clientId);
  const entry: DocEntry = { id: `r_${Date.now()}`, createdAt: Date.now(), ...doc };
  const next = { ...box, received: [entry, ...box.received] };
  saveBox(clientId, next);
  return next;
}
