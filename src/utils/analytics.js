export const trackPageView = (pageName) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_title: pageName,
      page_path: `/${pageName}`,
    });
  }
};

export const trackEvent = (eventName, params = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};