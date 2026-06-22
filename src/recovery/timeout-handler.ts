export class TimeoutHandler {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 60000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Execute function with timeout
   */
  async withTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeout);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Execute function with default timeout
   */
  async withDefaultTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTimeout(fn, this.defaultTimeout);
  }

  /**
   * Execute navigation with timeout
   */
  async navigateWithTimeout(
    page: any,
    url: string,
    timeout: number = 15000
  ): Promise<void> {
    await this.withTimeout(
      () => page.goto(url, { waitUntil: 'networkidle' }),
      timeout,
      `Navigation to ${url} timed out`
    );
  }

  /**
   * Execute extraction with timeout
   */
  async extractWithTimeout<T>(
    extraction: () => Promise<T>,
    timeout: number = 10000,
    operation: string = 'extraction'
  ): Promise<T> {
    return this.withTimeout(
      extraction,
      timeout,
      `${operation} timed out`
    );
  }
}
