/**
 * Opens an external link in a new tab without React Router interference
 * This bypasses React Router's link hijacking by using native browser APIs
 */
export const openExternalLink = (url: string): void => {
  try {
    // Create a link element with all necessary attributes
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    link.style.visibility = 'hidden';
    link.style.position = 'absolute';
    link.style.left = '-9999px';
    
    // Add to DOM
    document.body.appendChild(link);
    
    // Use setTimeout to ensure the element is in the DOM before clicking
    setTimeout(() => {
      try {
        // Trigger native click - this opens in new tab before React Router can intercept
        link.click();
        
        // Clean up after a delay
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 500);
      } catch (clickError) {
        console.error('Error clicking link:', clickError);
        // Cleanup on error
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }
    }, 0);
  } catch (error) {
    console.error('Error opening external link:', error);
  }
};
