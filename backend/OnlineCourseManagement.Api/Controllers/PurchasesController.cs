using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/purchases")]
[Authorize]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PurchasesController(PurchaseService purchases, DemoPaymentService demoPayments) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = AppPolicies.Learning)]
    public async Task<IActionResult> Create(CreatePurchaseDto input, CancellationToken token)
    {
        var purchase = await purchases.CreateAsync(input, User, token);
        return CreatedAtAction(nameof(Get), new { id = purchase.Id }, purchase);
    }

    [HttpGet("my")]
    [Authorize(Policy = AppPolicies.Learning)]
    public async Task<IActionResult> Mine([FromQuery, Range(1, 1_000_000)] int page = 1, CancellationToken token = default) =>
        Ok(await purchases.ListAsync(User, false, page, token));

    [HttpGet]
    [Authorize(Policy = AppPolicies.AccountAdministration)]
    public async Task<IActionResult> All([FromQuery, Range(1, 1_000_000)] int page = 1, CancellationToken token = default) =>
        Ok(await purchases.ListAsync(User, true, page, token));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken token)
    {
        var purchase = await purchases.GetAsync(id, User, token);
        return Ok(purchase with { CanConfirmDemoPayment = demoPayments.CanConfirm(User, purchase) });
    }

    /// <summary>Demo only: confirm the current user's purchase and grant course access without a bank transaction.</summary>
    [HttpPost("{id:int}/demo-confirm")]
    [Authorize(Policy = AppPolicies.Learning)]
    public async Task<IActionResult> ConfirmDemo(int id, CancellationToken token) =>
        Ok(await demoPayments.ConfirmAsync(id, User, token));

    /// <summary>Cancel a pending purchase. Users cancel their own orders; Admin can cancel any pending order.</summary>
    [HttpPost("{id:int}/cancel")]
    [Authorize(Roles = AppRoles.Admin + "," + AppRoles.User)]
    public async Task<IActionResult> Cancel(int id, CancellationToken token) =>
        Ok(await purchases.CancelAsync(id, User, token));

    [HttpPost("{id:int}/payment-link")]
    [Authorize(Policy = AppPolicies.Learning)]
    public async Task<IActionResult> PaymentLink(int id, CancellationToken token) =>
        Ok(await purchases.CreatePaymentLinkAsync(id, User, token));

    [HttpPost("{id:int}/sync")]
    public async Task<IActionResult> Sync(int id, CancellationToken token) => Ok(await purchases.SyncAsync(id, User, token));

    [HttpGet("{id:int}/invoice")]
    public async Task<IActionResult> Invoice(int id, CancellationToken token)
    {
        Response.Headers.CacheControl = "no-store";
        var purchase = await purchases.GetAsync(id, User, token);
        return Ok(new { number = purchase.InvoiceNumber, html = PurchaseInvoice.Render(purchase) });
    }

    [AllowAnonymous]
    [HttpPost("payos/webhook")]
    [RequestSizeLimit(65536)]
    public async Task<IActionResult> Webhook([FromBody] JsonElement body, CancellationToken token)
    {
        await purchases.ReceiveWebhookAsync(body, token);
        return Ok(new { code = "00", message = "Đã tiếp nhận" });
    }
}
