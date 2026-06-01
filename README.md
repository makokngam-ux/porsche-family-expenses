# ครอบครัวน้องพอร์ช

เว็บแอปบันทึกค่าใช้จ่ายครอบครัวแบบ static สำหรับเปิดผ่าน GitHub Pages ได้ทันที

## วิธีเอาขึ้น GitHub Pages

1. สร้าง repository ใหม่ใน GitHub เช่น `porsche-family-expenses`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repository
3. ไปที่ `Settings` > `Pages`
4. เลือก `Deploy from a branch`
5. เลือก branch `main` และ folder `/root`
6. กด `Save`

หลังจากนั้น GitHub จะให้ลิงก์ประมาณ:

```text
https://your-username.github.io/porsche-family-expenses/
```

## หมายเหตุเรื่องข้อมูล

เวอร์ชันนี้เก็บข้อมูลใน browser ของเครื่องที่ใช้งานด้วย `localStorage` และสามารถเชื่อม Google Sheets + Apps Script เพื่อ sync ข้ามเครื่องได้

หมายความว่า:

- เปิดออนไลน์ได้จริงผ่าน GitHub Pages
- ใช้บนมือถือได้
- ถ้ายังไม่ได้ตั้งค่า Google Sheets ข้อมูลจะอยู่เฉพาะเครื่องนั้น
- ถ้าตั้งค่า Google Sheets แล้ว สามารถบันทึกขึ้นชีตและโหลดจากชีตบนเครื่องอื่นได้

## วิธีตั้งค่า Google Sheets + Apps Script

1. สร้าง Google Sheet ใหม่ ตั้งชื่อเช่น `ครอบครัวน้องพอร์ช Expenses`
2. ไปที่ `Extensions` > `Apps Script`
3. ลบโค้ดเดิม แล้วคัดลอกโค้ดจากไฟล์ `google-apps-script.gs` ไปวาง
4. กด `Save`
5. กด `Deploy` > `New deployment`
6. เลือกชนิดเป็น `Web app`
7. ตั้งค่า `Execute as` เป็น `Me`
8. ตั้งค่า `Who has access` เป็น `Anyone`
9. กด `Deploy` แล้วคัดลอกลิงก์ Web App ที่ได้
10. กลับมาที่แอป กด `เพิ่มเติม` > `ซิงก์ Google Sheets`
11. วางลิงก์ Web App แล้วกด `บันทึกลิงก์`
12. เครื่องหลักให้กด `บันทึกขึ้นชีต` ก่อน จากนั้นเครื่องอื่นให้กด `โหลดจากชีต`
