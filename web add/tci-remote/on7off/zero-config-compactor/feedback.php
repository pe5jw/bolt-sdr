<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report a Bug / Feature Request - TCI Remote.</title>
  
  <style>
    :root {
      --bg: #0d1117;
      --panel: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text2: #8b949e;
      --primary: #58a6ff;
      --danger: #f85149;
      --success: #3fb950;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background-color: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    h2 {
      margin-top: 0;
      color: var(--primary);
      text-align: center;
    }
    label {
      display: block;
      margin-bottom: 6px;
      color: var(--text2);
      font-size: 14px;
      font-weight: bold;
    }
    input, select, textarea {
      width: 100%;
      padding: 10px;
      margin-bottom: 16px;
      background-color: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 6px;
      box-sizing: border-box;
      font-family: inherit;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    button {
      width: 100%;
      padding: 12px;
      background-color: var(--primary);
      color: #0d1117;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 16px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.8;
    }
    .msg {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-weight: bold;
      text-align: center;
    }
    .msg.success {
      background-color: rgba(63, 185, 80, 0.1);
      color: var(--success);
      border: 1px solid var(--success);
    }
    .msg.error {
      background-color: rgba(248, 81, 73, 0.1);
      color: var(--danger);
      border: 1px solid var(--danger);
    }
  </style>
</head>
<body>

<div class="container">
  <h2>🐞 Report a Bug / Feature Request</h2>
    <label for="type">If you want to report that WAD is not working. This is NORMAL as we have not yet released the newest compactor that has the WAD intelligence. Please be patient!<br>
  I hope to release the TCI Remote compactor somewhere next week, around August 18th 2026. <br><br>If you write a report, please be as specific as possible and write the bug report or feature request here in English, French, Dutch or Thai.<br><br></label  
  
  <form method="POST" action="feedback.php">
    <label for="type">Type</label>
    <select name="type" id="type" required>
      <option value="bug">Bug Report</option>
      <option value="feature">Feature Request</option>
    </select>

    <label for="platform">Which version are you using? (Required)</label>
    <select name="platform" id="platform" required>
      <option value="" disabled selected>-- Please select --</option>
              <option value="android">Android (TCI Remote app)</option>
              <option value="ios">iOS - iPhone / iPad (TCI Remote app)</option>
              <option value="windows">Windows PC (Compactor)</option>
          </select>

    <label for="callsign">Your Callsign (Required)</label>
    <input type="text" name="callsign" id="callsign" placeholder="e.g. ON7OFF" required>

    <label for="email">Your Email Address (Optional, for reply)</label>
    <input type="email" name="email" id="email" placeholder="e.g. name@example.com">

    <label for="desc">Description (Required)</label>
    <textarea name="desc" id="desc" rows="6" placeholder="Please describe the bug or feature request in detail..." required></textarea>

    <button type="submit">Submit Report</button>
  </form>
</div>

<script>window.__CF$cv$params={r:'a304b39b0bcf0bc0',t:'MTc4NzU5OTA5Mg==',u:'01a035357d287c00b02736495332fba5',ut:'A.eeZia1C4vj7JHQtxdadyyWLHi_8mDsNsFD1sui01o-1787599093-1.2.1.1-Uw9EvelNkNNZd4faHNaxVuQbp3Ri4O7zNEoJ_a55pxehtOuOW2TmqwOjHkj2_q2F89ko_eyKWA8u4reZB8Js1SowohDVYKk5VahMC9zVKRo',i:60};(function(){if(!document.body)return;var s=document.createElement('script');s.src='/cdn-cgi/challenge-platform/scripts/precursor/main.js';document.head.appendChild(s);})();</script></body>
</html>
