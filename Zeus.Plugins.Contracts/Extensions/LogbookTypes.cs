// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

namespace Zeus.Plugins.Contracts.Extensions;

public sealed record LogbookNewEntry(
    string Callsign,
    string? Name,
    double FrequencyMhz,
    string Band,
    string Mode,
    string RstSent,
    string RstRcvd,
    string? Grid = null,
    string? Country = null,
    int? Dxcc = null,
    int? CqZone = null,
    int? ItuZone = null,
    string? State = null,
    string? Comment = null,
    DateTime? QsoDateTimeUtc = null,
    Dictionary<string, string>? AdifFields = null);

public sealed record LogbookEntrySnapshot(
    string Id,
    DateTime QsoDateTimeUtc,
    string Callsign,
    string? Name,
    double? FrequencyMhz,
    string Band,
    string Mode,
    string RstSent,
    string RstRcvd,
    string? Grid,
    string? Country,
    int? Dxcc,
    int? CqZone,
    int? ItuZone,
    string? State,
    string? Comment,
    DateTime CreatedUtc,
    string? QrzLogId = null,
    DateTime? QrzUploadedUtc = null,
    Dictionary<string, string>? AdifFields = null);

public sealed record LogbookPage(
    IReadOnlyList<LogbookEntrySnapshot> Entries,
    int TotalCount);

public sealed record LogbookImportResult(
    int TotalRecords,
    int ImportedCount,
    int DuplicateCount,
    int SkippedCount,
    IReadOnlyList<LogbookImportError> Errors);

public sealed record LogbookImportError(
    int RecordNumber,
    string Message);

public sealed record LogbookExportFileResult(
    string Path,
    int Count,
    long Bytes);

public sealed record LogbookWorkedSummary(
    string Callsign,
    bool WorkedBefore,
    int TotalCount,
    DateTime? LastWorkedUtc,
    string? LastBand,
    string? LastMode,
    double? LastFrequencyMhz,
    string? LastRstSent,
    string? LastRstRcvd,
    string? LastName,
    string? LastGrid,
    string? LastCountry,
    string? LastState,
    string? LastComment,
    IReadOnlyList<string> Bands,
    IReadOnlyList<string> Modes,
    IReadOnlyList<LogbookWorkedRecentQso> RecentQsos);

public sealed record LogbookWorkedRecentQso(
    DateTime QsoDateTimeUtc,
    string? Band,
    string? Mode,
    double? FrequencyMhz,
    string? RstSent,
    string? RstRcvd,
    string? Name,
    string? Grid,
    string? Country,
    string? State,
    string? Comment,
    string? QrzLogId);
