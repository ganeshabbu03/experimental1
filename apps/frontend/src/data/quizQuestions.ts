export interface Question {
    question: string;
    options: string[];
    correct: number;
}

export const ALL_QUIZ_QUESTIONS: Question[] = [
    {
        question: "What does HTML stand for?",
        options: ["Hyper Text Markup Language", "High Tech Multi Language", "Hyper Tool Multi Level", "Home Tool Markup Language"],
        correct: 0
    },
    {
        question: "Which of these is used to declare a constant variable in JavaScript?",
        options: ["var", "let", "constant", "const"],
        correct: 3
    },
    {
        question: "What is the correct way to write an array in JavaScript?",
        options: ["{1, 2, 3}", "[1, 2, 3]", "(1, 2, 3)", "<1, 2, 3>"],
        correct: 1
    },
    {
        question: "Which CSS property is used to change the background color?",
        options: ["color", "bgcolor", "background-color", "fill"],
        correct: 2
    },
    {
        question: "What does CSS stand for?",
        options: ["Creative Style Sheets", "Computer Style Sheets", "Cascading Style Sheets", "Colorful Style Sheets"],
        correct: 2
    },
    {
        question: "Which HTML tag is used to define an unordered list?",
        options: ["<ol>", "<ul>", "<li>", "<list>"],
        correct: 1
    },
    {
        question: "How do you write 'Hello World' in an alert box?",
        options: ["msg('Hello World')", "alert('Hello World')", "prompt('Hello World')", "print('Hello World')"],
        correct: 1
    },
    {
        question: "Which symbol is used for comments in JavaScript?",
        options: ["//", "/* */", "#", "Both // and /* */"],
        correct: 3
    },
    {
        question: "Which property is used to change the font of an element?",
        options: ["font-style", "font-weight", "font-family", "font-size"],
        correct: 2
    },
    {
        question: "What is the default value of the postion property in CSS?",
        options: ["relative", "fixed", "absolute", "static"],
        correct: 3
    },
    {
        question: "In React, what are 'props' used for?",
        options: ["Managing internal state", "Passing data between components", "Styling components", "Routing"],
        correct: 1
    },
    {
        question: "Which HTML tag is used for the largest heading?",
        options: ["<h6>", "<head>", "<heading>", "<h1>"],
        correct: 3
    },
    {
        question: "What does 'JS' stand for?",
        options: ["JustScript", "JavaSyntax", "JavaScript", "JumbledScript"],
        correct: 2
    },
    {
        question: "Which operator is used to check for both value and type equality?",
        options: ["=", "==", "===", "!="],
        correct: 2
    },
    {
        question: "Which CSS property adds space outside an element's border?",
        options: ["padding", "margin", "border-spacing", "gap"],
        correct: 1
    }
];

export const getRandomQuestions = (count: number = 5): Question[] => {
    const shuffled = [...ALL_QUIZ_QUESTIONS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};
