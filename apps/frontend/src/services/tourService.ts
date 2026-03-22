import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// We'll define a custom theme class in index.css later, 
// using the class 'deexen-tour-popover'

export const runDashboardTour = (onComplete: () => void) => {
    const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: 'Finish',
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        popoverClass: 'deexen-tour-popover',
        onDestroyed: onComplete,
        steps: [
            {
                element: '#sidebar-nav-projects',
                popover: {
                    title: 'Projects',
                    description: 'Access all your projects here.',
                    side: "right",
                    align: 'center',
                }
            },
            {
                element: '#dashboard-search-bar',
                popover: {
                    title: 'Search',
                    description: 'Quickly find projects with ⌘K',
                    side: "bottom",
                    align: 'start',
                }
            },
            {
                element: '#theme-toggle-btn',
                popover: {
                    title: 'Theme',
                    description: 'Switch between light and dark mode.',
                    side: "bottom",
                    align: 'center',
                }
            },
            {
                element: '#new-project-btn',
                popover: {
                    title: 'Create New',
                    description: 'Start a new project from scratch or a template.',
                    side: "bottom",
                    align: 'end',
                }
            },
            {
                element: '#recent-projects-table tr:first-child',
                popover: {
                    title: 'Your Work',
                    description: 'Your recent projects appear here. Click to open.',
                    side: "top",
                    align: 'start',
                }
            }
        ]
    });

    driverObj.drive();
};

export const runWorkspaceTour = (onComplete: () => void) => {
    const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: 'Ready to Code',
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        popoverClass: 'deexen-tour-popover',
        onDestroyed: onComplete,
        steps: [
            {
                element: '#back-to-dashboard-btn',
                popover: {
                    title: 'Back Home',
                    description: 'Return to the dashboard anytime.',
                    side: "bottom",
                    align: 'start',
                }
            },
            {
                element: '#activity-bar-explorer',
                popover: {
                    title: 'Explorer',
                    description: 'View your file structure.',
                    side: "right",
                    align: 'center',
                }
            },
            {
                element: '#activity-bar-search',
                popover: {
                    title: 'Search',
                    description: 'Find text across all files.',
                    side: "right",
                    align: 'center',
                }
            },
            {
                element: '#activity-bar-git',
                popover: {
                    title: 'Source Control',
                    description: 'Manage git changes and commits.',
                    side: "right",
                    align: 'center',
                }
            },
            {
                element: '#file-explorer-pane',
                popover: {
                    title: 'File Tree',
                    description: 'Manage files and folders here.',
                    side: "right",
                    align: 'start',
                }
            },
            {
                element: '#editor-pane',
                popover: {
                    title: 'Code Editor',
                    description: 'Write your code here with full IntelliSense.',
                    side: "left",
                    align: 'center',
                }
            },
            {
                element: '#terminal-toggle-btn',
                popover: {
                    title: 'Terminal',
                    description: 'Open the integrated terminal.',
                    side: "bottom",
                    align: 'center',
                }
            },
            {
                element: '#run-project-btn',
                popover: {
                    title: 'Run',
                    description: 'Execute your code and see the output.',
                    side: "bottom",
                    align: 'end',
                }
            },
            {
                element: '#ai-panel-toggle',
                popover: {
                    title: 'AI Assistant',
                    description: 'Toggle the AI panel for help.',
                    side: "left",
                    align: 'start',
                }
            }
        ]
    });

    driverObj.drive();
};
