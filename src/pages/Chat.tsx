} else {
  // Exibir a partir do último ASSIGNED (incluindo a mensagem de escolha 0–4 se veio logo antes)
  let assignPos = -1;
  for (let i = (contactHistory?.length || 0) - 1; i >= 0; i--) {
    const subj = (contactHistory![i].subject || "") as string;
    if (subj.startsWith("ROUTING:ASSIGNED")) {
      assignPos = i;
      break;
    }
  }
  if (assignPos >= 0) {
    let start = assignPos + 1;
    if (assignPos > 0) {
      const prev = contactHistory![assignPos - 1];
      const prevText = (prev.description || prev.subject || "").trim();
      const prevIsRouting = ((prev.subject || "") as string).startsWith("ROUTING:");
      if (!prevIsRouting && /^[0-4]$/.test(prevText)) {
        start = assignPos - 1; // inclui a escolha do menu
      }
    }
    showFromIndex = start;
  } else {
    showFromIndex = 0;
  }
}
