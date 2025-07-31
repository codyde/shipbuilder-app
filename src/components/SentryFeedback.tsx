import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import * as Sentry from "@sentry/react"
import { useTheme } from '@/context/ThemeContext'

interface SentryFeedbackProps {
  className?: string
}

export function SentryFeedback({ className = "" }: SentryFeedbackProps) {
  const [feedback, setFeedback] = useState<ReturnType<typeof Sentry.getFeedback> | null>(null)
  const [isAttached, setIsAttached] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { theme } = useTheme()

  // Initialize feedback on client side only to avoid hydration errors
  useEffect(() => {
    const sentryFeedback = Sentry.getFeedback()
    setFeedback(sentryFeedback)
  }, [])

  // Attach feedback to our custom button
  useEffect(() => {
    if (!feedback || !buttonRef.current || isAttached) return

    try {
      feedback.attachTo(buttonRef.current, {
        formTitle: "Send Feedback",
        submitButtonLabel: "Send Feedback",
        cancelButtonLabel: "Cancel",
        nameLabel: "Name",
        namePlaceholder: "Your Name (optional)",
        emailLabel: "Email", 
        emailPlaceholder: "your.email@example.org",
        messageLabel: "Description",
        messagePlaceholder: "What's the issue? How can we improve?",
        isNameRequired: false,
        isEmailRequired: false,
        showName: true,
        showEmail: true,
        enableScreenshot: true,
      })
      setIsAttached(true)
    } catch (error) {
      console.error('Failed to attach feedback to button:', error)
    }
  }, [feedback, isAttached])

  // Monitor for feedback modal creation and force positioning
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            
            // Check if this is a Sentry feedback dialog
            const feedbackDialog = element.matches?.('dialog[data-sentry-feedback], dialog.sentry-feedback, [data-sentry-component="FeedbackModal"]') 
              ? element
              : element.querySelector?.('dialog[data-sentry-feedback], dialog.sentry-feedback, [data-sentry-component="FeedbackModal"]')

            if (feedbackDialog) {
              // Force left positioning immediately
              const dialogElement = feedbackDialog as HTMLElement
              dialogElement.style.setProperty('position', 'fixed', 'important')
              dialogElement.style.setProperty('left', '24px', 'important')
              dialogElement.style.setProperty('top', '50%', 'important')
              dialogElement.style.setProperty('right', 'auto', 'important')
              dialogElement.style.setProperty('bottom', 'auto', 'important')
              dialogElement.style.setProperty('transform', 'translateY(-50%)', 'important')
              dialogElement.style.setProperty('z-index', '9999', 'important')
              dialogElement.style.setProperty('max-width', '400px', 'important')
              dialogElement.style.setProperty('width', '400px', 'important')
              dialogElement.style.setProperty('margin', '0', 'important')
              
              console.log('Feedback modal positioned on left side')
            }
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => observer.disconnect()
  }, [])

  // Add custom CSS variables for theme integration
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'sentry-feedback-theme'
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById('sentry-feedback-theme')
    if (existingStyle) {
      document.head.removeChild(existingStyle)
    }

    style.textContent = `
      /* Target all possible Sentry feedback modal selectors */
      dialog[data-sentry-feedback],
      dialog.sentry-feedback,
      .sentry-feedback,
      [data-sentry-component="FeedbackModal"],
      [data-sentry-element="feedback-dialog"] {
        position: fixed !important;
        left: 24px !important;
        top: 50% !important;
        right: auto !important;
        bottom: auto !important;
        transform: translateY(-50%) !important;
        z-index: 9999 !important;
        max-width: 400px !important;
        width: 400px !important;
        margin: 0 !important;
      }
      
      /* More specific targeting for nested elements */
      body dialog[open]:has([data-sentry-component]),
      body dialog[open].sentry-feedback,
      body > dialog[data-sentry-feedback] {
        position: fixed !important;
        left: 24px !important;
        top: 50% !important;
        right: auto !important;
        bottom: auto !important;
        transform: translateY(-50%) !important;
        z-index: 9999 !important;
        max-width: 400px !important;
        width: 400px !important;
        margin: 0 !important;
      }
      
      /* Target the actual feedback form container */
      [data-sentry-component="FeedbackModal"] > div,
      .sentry-feedback > div,
      dialog[data-sentry-feedback] > div {
        position: relative !important;
        left: 0 !important;
        right: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        transform: none !important;
      }
      
      /* Ensure all dialog elements are positioned left */
      dialog:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) {
        position: fixed !important;
        left: 24px !important;
        top: 50% !important;
        right: auto !important;
        bottom: auto !important;
        transform: translateY(-50%) !important;
        z-index: 9999 !important;
        max-width: 400px !important;
        width: 400px !important;
        margin: 0 !important;
        
        --feedback-font-family: 'Inter', 'system-ui', sans-serif;
        --feedback-font-size: 14px;
        --feedback-border-radius: 8px;
        --feedback-box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        
        /* Theme-aware colors */
        ${theme === 'light' ? `
          --feedback-foreground: hsl(224, 71.4%, 4.1%);
          --feedback-background: hsl(0, 0%, 100%);
          --feedback-accent-background: hsl(220.9, 39.3%, 11%);
          --feedback-accent-foreground: hsl(210, 20%, 98%);
          --feedback-border: hsl(220, 13%, 91%);
        ` : `
          --feedback-foreground: hsl(210, 20%, 98%);
          --feedback-background: hsl(224, 71.4%, 4.1%);
          --feedback-accent-background: hsl(210, 20%, 98%);
          --feedback-accent-foreground: hsl(220.9, 39.3%, 11%);
          --feedback-border: hsl(215, 27.9%, 16.9%);
        `}
        
        --feedback-success-color: hsl(142.1, 76.2%, 36.3%);
        --feedback-error-color: hsl(0, 84.2%, 60.2%);
      }
      
      /* Override any inline styles */
      dialog[style*="right"]:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) {
        right: auto !important;
        left: 24px !important;
      }
      
      dialog[style*="bottom"]:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) {
        bottom: auto !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
      
      /* Handle mobile responsiveness */
      @media (max-width: 768px) {
        dialog[data-sentry-feedback],
        dialog.sentry-feedback,
        .sentry-feedback,
        [data-sentry-component="FeedbackModal"] {
          left: 16px !important;
          right: 16px !important;
          width: auto !important;
          max-width: none !important;
          transform: translateY(-50%) !important;
        }
      }
      
      /* Style form elements */
      dialog:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) button {
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      dialog:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) input,
      dialog:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) textarea {
        border-radius: 6px;
        border: 1px solid var(--feedback-border);
        transition: border-color 0.2s;
      }
      
      dialog:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) input:focus,
      dialog:is([data-sentry-feedback], .sentry-feedback, [data-sentry-component="FeedbackModal"]) textarea:focus {
        outline: 2px solid var(--feedback-accent-background);
        outline-offset: 2px;
      }
      
      /* Force left positioning with highest specificity */
      html body dialog[open][data-sentry-feedback],
      html body dialog[open].sentry-feedback,
      html body [data-sentry-component="FeedbackModal"] {
        position: fixed !important;
        left: 24px !important;
        top: 50% !important;
        right: auto !important;
        bottom: auto !important;
        transform: translateY(-50%) !important;
        z-index: 9999 !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [theme])

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      className={`h-9 justify-start gap-2 group-data-[collapsible=icon]:justify-center ${className}`}
      title="Send Feedback"
      disabled={!feedback}
    >
      <MessageSquare className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium group-data-[collapsible=icon]:sr-only">Send Feedback</span>
    </Button>
  )
}