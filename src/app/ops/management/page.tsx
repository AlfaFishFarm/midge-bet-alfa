import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel, hasManagerRole } from "@/lib/permissions";

export default async function OpsManagementScreen() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  // Spec p24: management screens are for manager-type roles only (ניהול תחום /
  // הנהלה / מנהל צופה) — a regular field worker with תפעול access is blocked.
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY) || !hasManagerRole(user.permissions, "תפעול")) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה. מסכי ניהול תפעול זמינים למנהלים בלבד.</p>
      </main>
    );
  }

  return (
    <div id="ops-mgmt-screen" className="sub-screen">
      <div className="sub-screen-header">
        <Link href="/ops" className="sub-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          חזרה
        </Link>
        <div className="sub-breadcrumb">
          <span>תפעול</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{color:"#1A2B1F",fontWeight:600}}>ניהול תפעול</span>
        </div>
      </div>
      <div className="sub-title-area">
        <div className="sub-title">ניהול תפעול</div>
        <div className="sub-title-thai">การจัดการปฏิบัติงาน</div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"14px",padding:"16px 20px",maxWidth:"680px",margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

        <Link href="/ops/management/open-pool" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#3D9A6A,#2C7A52)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #1A5435,0 6px 16px rgba(28,84,53,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>פתיחת בריכה</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>การเปิดบ่อ</span>
          </div>
          <span style={{fontSize:"28px"}}>🏊</span>
        </Link>

        <Link href="/ops/management/close-pool" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#E8544A,#C93B31)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #8B2820,0 6px 16px rgba(139,40,32,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>סגירת (חיסול) בריכה</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>ปิดบ่อ (ปิดถาวร)</span>
          </div>
          <span style={{fontSize:"28px"}}>🔒</span>
        </Link>

        <Link href="/ops/management/deliveries" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#3A8FD4,#2271B2)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",boxShadow:"0 5px 0 #144D80,0 6px 16px rgba(20,77,128,0.3)",transition:"all .15s"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>ניהול תעודות משלוח</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>ออกใบส่งสินค้า</span>
          </div>
          <span style={{fontSize:"28px"}}>📄</span>
        </Link>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#F0983A,#D97B1A)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"not-allowed",fontFamily:"inherit",boxShadow:"0 5px 0 #9E560E,0 6px 16px rgba(158,86,14,0.3)",transition:"all .15s",opacity:0.65}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>בניית תוכנית שבועית</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>วางแผนรายสัปดาห์</span>
          </div>
          <span style={{fontSize:"28px"}}>📅</span>
        </div>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,#F5B820,#D99A08)",border:"none",borderRadius:"14px",padding:"18px 22px",cursor:"not-allowed",fontFamily:"inherit",boxShadow:"0 5px 0 #9A6B04,0 6px 16px rgba(154,107,4,0.3)",transition:"all .15s",opacity:0.65}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontSize:"17px",fontWeight:800,color:"white"}}>בניית תוכנית שנתית</span>
            <span style={{fontSize:"12px",color:"rgba(255,255,255,0.7)"}}>วางแผนรายปี</span>
          </div>
          <span style={{fontSize:"28px"}}>🗓️</span>
        </div>

      </div>
    </div>
  );
}
