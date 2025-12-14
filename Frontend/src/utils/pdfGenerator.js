// utils/pdfGenerator.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateLeavePDF = async (leave) => {
  return new Promise((resolve, reject) => {
    try {
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set document properties
      doc.setProperties({
        title: `Leave Approval - ${leave.employeeDetails?.name || 'Employee'}`,
        subject: 'Leave Application Approval',
        author: 'OBU Leave Management System',
        keywords: 'leave, approval, HR, document',
        creator: 'OBU LMS'
      });

      // Company Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210); // Blue color
      doc.text('OBU LEAVE MANAGEMENT SYSTEM', 105, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 51, 51);
      doc.text('Leave Approval Certificate', 105, 30, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Document ID: ${leave.id}`, 105, 37, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 42, { align: 'center' });

      // Separator line
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(0.5);
      doc.line(20, 50, 190, 50);

      // Employee Information
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('EMPLOYEE INFORMATION', 20, 60);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const employeeInfo = [
        ['Name', leave.employeeDetails?.name || 'N/A'],
        ['Employee ID', leave.employeeDetails?.id || 'N/A'],
        ['Position', leave.employeeDetails?.position || 'N/A'],
        ['Department', leave.employeeDetails?.department || 'N/A'],
        ['Email', leave.employeeDetails?.email || 'N/A'],
        ['Phone', leave.employeeDetails?.phone || 'N/A'],
        ['Join Date', leave.employeeDetails?.joinDate ? new Date(leave.employeeDetails.joinDate).toLocaleDateString() : 'N/A']
      ];

      // AutoTable for employee info
      doc.autoTable({
        startY: 65,
        head: [['Field', 'Details']],
        body: employeeInfo,
        theme: 'grid',
        headStyles: { fillColor: [25, 118, 210], textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 }
      });

      // Leave Details
      const tableY = doc.lastAutoTable.finalY + 15;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('LEAVE DETAILS', 20, tableY);

      const leaveInfo = [
        ['Leave Type', leave.leaveType?.name || 'N/A'],
        ['Start Date', new Date(leave.startDate).toLocaleDateString()],
        ['End Date', new Date(leave.endDate).toLocaleDateString()],
        ['Duration', `${leave.days} working days`],
        ['Applied Date', new Date(leave.appliedDate).toLocaleDateString()],
        ['Status', leave.status === 'HR_APPROVED' ? 'HR Approved' : leave.status],
        ['Requires HR Approval', leave.leaveType?.requiresHRApproval ? 'Yes' : 'No']
      ];

      doc.autoTable({
        startY: tableY + 5,
        head: [['Field', 'Details']],
        body: leaveInfo,
        theme: 'grid',
        headStyles: { fillColor: [76, 175, 80], textColor: 255 }, // Green color
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 }
      });

      // Reason Section
      const reasonY = doc.lastAutoTable.finalY + 15;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('REASON FOR LEAVE', 20, reasonY);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const reasonText = doc.splitTextToSize(leave.reason || 'No reason provided', 170);
      doc.text(reasonText, 20, reasonY + 10);

      // Approval History
      const approvalY = doc.lastAutoTable.finalY + 30 + (reasonText.length * 4);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('APPROVAL HISTORY', 20, approvalY);

      if (leave.approvalHistory && leave.approvalHistory.length > 0) {
        const approvalData = leave.approvalHistory.map(entry => [
          new Date(entry.date).toLocaleDateString(),
          entry.action,
          entry.by,
          entry.notes || '-'
        ]);

        doc.autoTable({
          startY: approvalY + 5,
          head: [['Date', 'Action', 'Approver', 'Notes']],
          body: approvalData,
          theme: 'grid',
          headStyles: { fillColor: [255, 152, 0], textColor: 255 }, // Orange color
          styles: { fontSize: 8 },
          margin: { left: 20, right: 20 }
        });
      }

      // Manager Decision
      if (leave.managerApproved !== undefined) {
        const managerY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : approvalY + 30;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('MANAGER DECISION', 20, managerY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const managerText = [
          `Decision: ${leave.managerApproved ? '✅ Approved' : '❌ Rejected'}`,
          `Manager: ${leave.managerDetails?.name || 'N/A'}`,
          `Date: ${leave.managerApprovedDate ? new Date(leave.managerApprovedDate).toLocaleDateString() : 'N/A'}`,
          `Notes: ${leave.managerNotes || 'No notes provided'}`
        ];

        doc.text(managerText, 20, managerY + 10);
      }

      // HR Decision (if approved)
      if (leave.status === 'HR_APPROVED') {
        const hrY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 30 : doc.internal.pageSize.height - 60;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(76, 175, 80); // Green color
        doc.text('HR FINAL APPROVAL', 105, hrY, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('This leave application has been reviewed and approved by the HR Department.', 105, hrY + 8, { align: 'center' });
        doc.text('All necessary requirements have been met and the leave is hereby granted.', 105, hrY + 16, { align: 'center' });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Page number
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
        
        // Confidential footer
        doc.text('CONFIDENTIAL - OBU Internal Use Only', 105, 290, { align: 'center' });
        
        // Footer separator
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(20, 280, 190, 280);
      }

      // Generate filename
      const filename = `Leave_Approval_${leave.employeeDetails?.name?.replace(/\s+/g, '_')}_${leave.id}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Save PDF
      doc.save(filename);
      
      resolve(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
};