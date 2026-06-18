// Respuesta a una pregunta sobre la grabación ("Pregúntale a tu grabación").
// Claude la emite vía tool use (JSON garantizado) y el cliente la pinta con
// citas clicables que saltan el reproductor al momento exacto.

/** Cita a un momento del audio que respalda la respuesta. */
export type Citation = {
  /** Instante en segundos (salta el reproductor ahí). */
  time: number;
  /** Fragmento breve citado de la transcripción. */
  quote: string;
};

export type Answer = {
  /** false si la respuesta no está en la grabación. */
  found: boolean;
  /** Respuesta en español, basada solo en la transcripción. */
  answer: string;
  /** Momentos que respaldan la respuesta (vacío si found=false). */
  citations: Citation[];
};
