# WDD 231 Final Project - Video Demonstration Script

**Project:** Mummy J's Treats Website  
**Author:** Henry M Ugochukwu  
**Duration:** 3-5 minutes  
**Focus:** Demonstrate JavaScript requirements only

---

## PRE-RECORDING CHECKLIST

- [ ] Open VS Code with project files ready
- [ ] Have browser open to the live site (GitHub Pages)
- [ ] Have browser DevTools Console open
- [ ] Camera positioned to show your face
- [ ] Screen recording software ready
- [ ] Test audio levels

---

## SCRIPT OUTLINE

### Introduction (0:00 - 0:15)

**What to say:**
"Hi, I'm Henry Ugochukwu, and this is my WDD 231 final project demonstration for Mummy J's Treats website. I'll be showing you how I implemented the required JavaScript functionality, specifically the API/data integration and asynchronous error handling."

**What to show:**

- Your face on camera
- Brief view of the website homepage

---

### PART 1: API/Data Integration (0:15 - 2:30)

#### Step 1: Show the JSON Data File (0:15 - 0:45)

**What to say:**
"First, let me show you the data source. I'm using a local JSON file called Menu.json that contains 16 menu items."

**What to do:**

1. Switch to VS Code
2. Navigate to `final/data/Menu.json`
3. Show the file structure:
   - Point out it's an array of objects
   - Show a few items (id, name, category, price, desc, img)
   - Say: "Each item has 6 properties: id, name, category, price, description, and image path"

**What to say:**
"This JSON file contains 16 menu items, which exceeds the requirement of 15 items. Each item has multiple properties, exceeding the requirement of 4 properties per item."

---

#### Step 2: Show the Fetch Implementation (0:45 - 1:30)

**What to say:**
"Now let me show you how I fetch this data using the Fetch API."

**What to do:**

1. Navigate to `final/js/menu.js`
2. Scroll to the `loadMenu` function (around line 5)
3. Point out:
   - Line 5: `export async function loadMenu(container)` - async function
   - Line 14: `try {` - start of try block
   - Lines 20-39: Show the path resolution logic
   - Line 54: `res = await fetch(fullUrl, { method: 'HEAD' });` - Fetch API call
   - Line 58: `res = await fetch(fullUrl);` - Second fetch for actual data
   - Line 91: `const items = await res.json();` - Parsing JSON response

**What to say:**
"I'm using the Fetch API with async/await to retrieve the JSON data. The function tries multiple path formats to ensure compatibility with both local development and GitHub Pages deployment."

---

#### Step 3: Demonstrate Dynamic Content Generation (1:30 - 2:00)

**What to say:**
"Now let me show you how the data is dynamically displayed on the page."

**What to do:**

1. Switch to browser showing the live site
2. Navigate to `menu.html` or show the home page
3. Point to the menu grid area
4. Open DevTools Console (F12)
5. Show the console logs showing successful data loading
6. Point out the dynamically generated cards on the page

**What to say:**
"As you can see, all 16 menu items are dynamically generated from the JSON data. Each card displays the item name, description, price, and image. The data is loaded asynchronously when the page loads."

---

#### Step 4: Show the Array Method Usage (2:00 - 2:30)

**What to say:**
"Let me show you how I use array methods to process this data."

**What to do:**

1. Switch back to VS Code
2. Navigate to `menu.js` lines 99-113
3. Point out:
   - Line 100: `.map()` method - transforms each item into HTML
   - Line 113: `.join("")` - combines all HTML strings
   - Line 116: `.forEach()` - attaches event listeners to buttons

**What to say:**
"I use the `.map()` method to transform each JSON object into HTML card elements, and `.forEach()` to attach event listeners. This demonstrates efficient array processing."

---

### PART 2: Asynchronous Functionality with Try Block (2:30 - 4:00)

#### Step 5: Show the Try-Catch Block (2:30 - 3:30)

**What to say:**
"Now let me demonstrate the asynchronous error handling using try-catch blocks."

**What to do:**

1. In VS Code, show `menu.js` lines 14-152
2. Point out:
   - Line 14: `try {` - start of try block
   - Lines 50-72: Nested try-catch inside the loop for path attempts
   - Lines 74-89: Error handling if fetch fails
   - Lines 144-152: Outer catch block for any errors

**What to say:**
"I have a comprehensive try-catch structure. The outer try block wraps the entire fetch operation, and there's also a nested try-catch inside the loop that attempts multiple paths. If any error occurs, it's caught and displayed to the user."

---

#### Step 6: Demonstrate Error Handling (3:30 - 4:00)

**What to say:**
"Let me show you what happens when there's an error."

**What to do:**

1. Switch to browser
2. Open DevTools Console
3. Show the error handling:
   - Point out console.error messages
   - Show the user-friendly error message displayed on page
   - Explain: "If the JSON file can't be loaded, users see a helpful error message instead of a broken page"

**What to say:**
"The catch block catches any errors, logs detailed information to the console for debugging, and displays a user-friendly error message on the page. This ensures the site remains functional even if the data source is unavailable."

---

#### Step 7: Show Local Storage Implementation (4:00 - 4:30)

**What to say:**
"Let me also quickly show the localStorage implementation, which uses try-catch for error handling."

**What to do:**

1. Switch to VS Code
2. Navigate to `js/main.js` lines 33-44
3. Point out:
   - Line 35: `try {` - try block for localStorage
   - Lines 36-39: localStorage operations
   - Lines 40-43: catch block handling localStorage unavailability

**What to say:**
"I also use try-catch for localStorage operations. If localStorage isn't available, the catch block handles it gracefully, ensuring the site still works."

---

### Conclusion (4:30 - 5:00)

**What to say:**
"In summary, I've demonstrated:

1. API/Data integration using Fetch API to load JSON data
2. Dynamic content generation displaying 16 items with multiple properties
3. Asynchronous functionality with async/await
4. Comprehensive error handling using try-catch blocks
5. Array methods like map and forEach for data processing

All code follows best practices and includes proper error handling. Thank you for watching!"

**What to show:**

- Brief view of the working website
- Your face on camera

---

## KEY POINTS TO EMPHASIZE

### Must Mention:

1. ✅ **Fetch API** - "I use the Fetch API to retrieve data from Menu.json"
2. ✅ **Async/Await** - "The function is async and uses await for asynchronous operations"
3. ✅ **Try-Catch** - "I wrap the fetch in a try-catch block for error handling"
4. ✅ **JSON Parsing** - "I parse the JSON response using await res.json()"
5. ✅ **Dynamic Content** - "16 items are dynamically generated from the JSON data"
6. ✅ **Array Methods** - "I use .map() and .forEach() to process the data"

### Visual Demonstrations:

- Show the JSON file structure
- Show the fetch code in menu.js
- Show the working website with dynamic content
- Show console logs proving data loaded successfully
- Show error handling if possible

---

## TECHNICAL DETAILS TO HIGHLIGHT

### File Locations:

- **Data Source:** `final/data/Menu.json`
- **Fetch Code:** `final/js/menu.js` (lines 5-153)
- **Main Entry:** `final/js/main.js` (calls loadMenu)

### Code Highlights:

- **Line 5:** `export async function loadMenu(container)` - async function declaration
- **Line 14:** `try {` - try block start
- **Line 54:** `res = await fetch(fullUrl)` - Fetch API call
- **Line 91:** `const items = await res.json()` - JSON parsing
- **Line 100:** `.map()` - Array method for transformation
- **Line 116:** `.forEach()` - Array method for event listeners
- **Line 144:** `catch (err)` - Error handling

---

## TIPS FOR RECORDING

1. **Speak Clearly:** Enunciate technical terms
2. **Point with Cursor:** Use mouse cursor to highlight code
3. **Pause Between Sections:** Give viewers time to process
4. **Show Both Code and Result:** Alternate between code and browser
5. **Use Zoom:** Zoom in on code when needed (Ctrl/Cmd +)
6. **Test First:** Do a practice run to ensure timing
7. **Check Audio:** Ensure microphone is working
8. **Good Lighting:** Make sure your face is well-lit

---

## POST-RECORDING CHECKLIST

- [ ] Video is 3-5 minutes long
- [ ] Your face is visible throughout
- [ ] Code is clearly visible
- [ ] Website demonstration is clear
- [ ] Audio is clear and audible
- [ ] All required points are covered
- [ ] Upload to YouTube/Loom
- [ ] Set video to Public
- [ ] Update footer links with video URL

---

## EXAMPLE FOOTER LINK FORMAT

After uploading, update all HTML files:

```html
<a href="https://www.youtube.com/watch?v=YOUR_VIDEO_ID" target="_blank"
  >Video Demo</a
>
```

Or for Loom:

```html
<a href="https://www.loom.com/share/YOUR_VIDEO_ID" target="_blank"
  >Video Demo</a
>
```

---

**Good luck with your recording!** 🎥
