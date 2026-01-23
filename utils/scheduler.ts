
/**
 * Scheduler Utility for Time-Slicing (Chrome Native Strategy)
 * Utiliza a API Scheduler.postTask (Chrome 94+) para priorização de tarefas em nível de SO.
 * Isso permite que OCR e Renderização rodada em 'background' sem causar 'jank' no scroll.
 */

// Tipagem para a API Experimental/Nativa do Chrome
interface SchedulerPostTaskOptions {
  priority?: 'user-blocking' | 'user-visible' | 'background';
  signal?: AbortSignal;
  delay?: number;
}

interface Scheduler {
  postTask<T>(callback: () => T | Promise<T>, options?: SchedulerPostTaskOptions): Promise<T>;
}

declare global {
  interface Window {
    scheduler?: Scheduler;
  }
}

// Rastreamento de tarefas para cancelamento
const abortControllers = new Map<number, AbortController>();
let taskIdCounter = 0;

/**
 * Agenda uma tarefa usando a estratégia mais eficiente disponível no navegador.
 * No Chrome 143+, isso usa threads de prioridade nativa.
 */
export const scheduleWork = (
  callback: (deadline?: { timeRemaining: () => number, didTimeout: boolean }) => void, 
  options: { priority?: 'background' | 'user-visible' | 'user-blocking', timeout?: number } = {}
): number => {
  const taskId = ++taskIdCounter;
  const controller = new AbortController();
  abortControllers.set(taskId, controller);

  // ESTRATÉGIA 1: Chrome Native Scheduler (Aceleração de Hardware para Task Management)
  if (typeof window !== 'undefined' && window.scheduler) {
    const priority = options.priority || 'background';
    
    window.scheduler.postTask(() => {
      // Cria um deadline virtual para compatibilidade com código legado que espera requestIdleCallback
      const start = performance.now();
      const deadline = {
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (performance.now() - start))
      };
      
      try {
        callback(deadline);
      } finally {
        abortControllers.delete(taskId);
      }
    }, {
      priority,
      signal: controller.signal,
      delay: 0
    }).catch(err => {
      // Ignora erros de cancelamento intencional
      if (err.name !== 'AbortError' && err.name !== 'TaskAbortedError') {
        console.warn("[Scheduler] Task falhou:", err);
      }
      abortControllers.delete(taskId);
    });

    return taskId;
  }

  // ESTRATÉGIA 2: Fallback Legacy (requestIdleCallback)
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const handle = (window as any).requestIdleCallback(
      (deadline: any) => {
        try {
          if (!controller.signal.aborted) callback(deadline);
        } finally {
          abortControllers.delete(taskId);
        }
      },
      { timeout: options.timeout || 1000 }
    );
    // Mapeamos o handle do rIC para nosso ID virtual se necessário, 
    // mas aqui simplificamos usando o AbortController lógico.
    return taskId;
  }

  // ESTRATÉGIA 3: Fallback setTimeout (Emergência)
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      callback({ didTimeout: true, timeRemaining: () => 0 });
      abortControllers.delete(taskId);
    }
  }, 1);
  
  return taskId;
};

export const cancelWork = (id: number) => {
  if (abortControllers.has(id)) {
    abortControllers.get(id)?.abort();
    abortControllers.delete(id);
  }
};
