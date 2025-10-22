export const ONBOARDING_STEPS = [
  {
    id: 0,
    type: "welcome",
    page: "/dashboard/",
    title: "Welcome to QueryFuel! 🚀",
    description: "Let's create your first AI-powered article together. I'll guide you step-by-step!",
    target: null,
    action: "modal",
    tooltip: {
      text: "Follow the highlights to create your first article in minutes!",
      position: "center",
      showPulse: false
    }
  },
  
  {
    id: 1,
    type: "navigation",
    page: "/dashboard/",
    title: "Step 1: Start Creating",
    description: "Click the 'Create New Article' button to begin!",
    target: "button:has-text('Create New Article')",
    action: "click",
    tooltip: {
      text: "👆 Click this button to start creating your first article",
      position: "bottom",
      showPulse: true
    }
  },
  
  {
    id: 2,
    type: "selection",
    page: "/dashboard/create/interview/",
    title: "Step 2: Choose Article Type",
    description: "Click on 'Choose Keyword Article' - it's perfect for beginners!",
    target: "button:has-text('Choose Keyword Article')",
    action: "click",
    tooltip: {
      text: "👆 Click 'Choose Keyword Article' - the easiest way to start!",
      position: "top",
      showPulse: true
    }
  },
  
  {
    id: 3,
    type: "navigation_continue",
    page: "/dashboard/create/interview/",
    title: "Step 3: Continue",
    description: "Great! Now click 'Continue' or 'Next' to proceed.",
    target: "button:has-text('Continue'), button:has-text('Next')",
    action: "click",
    tooltip: {
      text: "👆 Click here to continue to the next step",
      position: "bottom",
      showPulse: true
    }
  },
  
  {
    id: 4,
    type: "input",
    page: "/dashboard/create/keyword/",
    title: "Step 4: Enter Your Topic",
    description: "Type any topic you're interested in!",
    target: "input[type='text'], textarea",
    action: "type",
    tooltip: {
      text: "👆 Type your topic here - try 'Digital Marketing' or 'AI Technology'",
      position: "bottom",
      showPulse: false
    },
    suggestions: [
      "Digital Marketing",
      "AI Technology", 
      "Web Development",
      "Social Media Strategy"
    ]
  },
  
  {
    id: 5,
    type: "action",
    page: "/dashboard/create/keyword/",
    title: "Step 5: Generate Article",
    description: "Click 'Generate Article' and watch AI work its magic!",
    target: "button[type='submit'], button:contains('Generate Article'), button:contains('Generate')",
    action: "click",
    tooltip: {
      text: "👆 Click here to let AI create your article! ✨",
      position: "top",
      showPulse: true
    }
  },
  
  {
    id: 6,
    type: "completion",
    page: "/dashboard/articles/", // This will match both /dashboard/articles/ and /dashboard/articles/view/
    title: "🎉 Congratulations!",
    description: "You've created your first AI-powered article!",
    target: null, // Don't highlight any specific element
    action: "complete",
    tooltip: {
      text: "🎊 Your article is ready! You can now publish, edit, or create more content.",
      position: "center", // Center the message since no specific target
      showPulse: false
    }
  }
];