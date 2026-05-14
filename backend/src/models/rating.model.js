import { query } from '../utils/config/db.js';

const VALID_ISSUE_FLAGS = [
    'incorrect_information',
    'confusing_explanations',
    'too_long',
    'too_short',
    'repetitive_content',
    'formatting_issues',
    'poor_examples',
];

export { VALID_ISSUE_FLAGS };

class RatingModel {
    // ── Write ──────────────────────────────────────────────────────────────────

    static async upsert(userId, materialId, data) {
        const {
            overall_rating,
            learning_effectiveness = null,
            difficulty_level = null,
            written_feedback = null,
            issue_flags = [],
            engagement_seconds = 0,
        } = data;

        const result = await query(
            `INSERT INTO material_ratings
                (user_id, material_id, overall_rating, learning_effectiveness,
                 difficulty_level, written_feedback, issue_flags, engagement_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (user_id, material_id) DO UPDATE SET
                overall_rating         = EXCLUDED.overall_rating,
                learning_effectiveness = EXCLUDED.learning_effectiveness,
                difficulty_level       = EXCLUDED.difficulty_level,
                written_feedback       = EXCLUDED.written_feedback,
                issue_flags            = EXCLUDED.issue_flags,
                engagement_seconds     = GREATEST(material_ratings.engagement_seconds, EXCLUDED.engagement_seconds),
                updated_at             = NOW()
             RETURNING *`,
            [
                userId,
                materialId,
                overall_rating,
                learning_effectiveness,
                difficulty_level,
                written_feedback,
                JSON.stringify(issue_flags),
                engagement_seconds,
            ]
        );
        return result.rows[0];
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    static async findByUserAndMaterial(userId, materialId) {
        const result = await query(
            `SELECT * FROM material_ratings
             WHERE user_id = $1 AND material_id = $2`,
            [userId, materialId]
        );
        return result.rows[0] || null;
    }

    static async existsByUserAndMaterial(userId, materialId) {
        const result = await query(
            `SELECT 1 FROM material_ratings
             WHERE user_id = $1 AND material_id = $2 LIMIT 1`,
            [userId, materialId]
        );
        return result.rowCount > 0;
    }

    static async findByMaterial(materialId, { limit = 50, offset = 0 } = {}) {
        const result = await query(
            `SELECT r.*, u.name AS user_name
             FROM material_ratings r
             JOIN users u ON u.id = r.user_id
             WHERE r.material_id = $1
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3`,
            [materialId, limit, offset]
        );
        return result.rows;
    }

    // ── Analytics aggregation (called after each upsert) ──────────────────────

    static async computeAndCacheAnalytics(materialId) {
        // Single query aggregates everything needed
        const agg = await query(
            `SELECT
                COUNT(*)::int                                           AS total_ratings,
                ROUND(AVG(overall_rating)::numeric, 2)                 AS avg_rating,

                -- distribution: {1:..,2:..,3:..,4:..,5:..}
                jsonb_build_object(
                    '1', COUNT(*) FILTER (WHERE overall_rating = 1),
                    '2', COUNT(*) FILTER (WHERE overall_rating = 2),
                    '3', COUNT(*) FILTER (WHERE overall_rating = 3),
                    '4', COUNT(*) FILTER (WHERE overall_rating = 4),
                    '5', COUNT(*) FILTER (WHERE overall_rating = 5)
                ) AS rating_distribution,

                -- effectiveness rate (% who said yes)
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE learning_effectiveness = TRUE)
                    / NULLIF(COUNT(*) FILTER (WHERE learning_effectiveness IS NOT NULL), 0),
                2) AS effectiveness_rate,

                -- difficulty distribution counts
                jsonb_build_object(
                    'too_easy',     COUNT(*) FILTER (WHERE difficulty_level = 'too_easy'),
                    'appropriate',  COUNT(*) FILTER (WHERE difficulty_level = 'appropriate'),
                    'too_difficult',COUNT(*) FILTER (WHERE difficulty_level = 'too_difficult')
                ) AS difficulty_distribution

             FROM material_ratings
             WHERE material_id = $1`,
            [materialId]
        );

        const row = agg.rows[0];
        if (!row || row.total_ratings === 0) return null;

        // Compute issue frequency from all issue_flags arrays
        const flagsResult = await query(
            `SELECT issue_flags FROM material_ratings
             WHERE material_id = $1 AND jsonb_array_length(issue_flags) > 0`,
            [materialId]
        );
        const issueFrequency = {};
        for (const { issue_flags } of flagsResult.rows) {
            const flags = Array.isArray(issue_flags) ? issue_flags : [];
            for (const flag of flags) {
                issueFrequency[flag] = (issueFrequency[flag] || 0) + 1;
            }
        }

        // Weekly satisfaction trend (last 12 weeks)
        const trendResult = await query(
            `SELECT
                TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS week,
                ROUND(AVG(overall_rating)::numeric, 2)                 AS avg
             FROM material_ratings
             WHERE material_id = $1
               AND created_at >= NOW() - INTERVAL '12 weeks'
             GROUP BY DATE_TRUNC('week', created_at)
             ORDER BY DATE_TRUNC('week', created_at)`,
            [materialId]
        );

        const analytics = {
            material_id:              materialId,
            avg_rating:               row.avg_rating,
            total_ratings:            row.total_ratings,
            rating_distribution:      row.rating_distribution,
            effectiveness_rate:       row.effectiveness_rate ?? 0,
            difficulty_distribution:  row.difficulty_distribution,
            issue_frequency:          issueFrequency,
            satisfaction_trend:       trendResult.rows,
            last_computed_at:         new Date().toISOString(),
        };

        await query(
            `INSERT INTO material_rating_analytics
                (material_id, avg_rating, total_ratings, rating_distribution,
                 effectiveness_rate, difficulty_distribution, issue_frequency,
                 satisfaction_trend, last_computed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
             ON CONFLICT (material_id) DO UPDATE SET
                avg_rating               = EXCLUDED.avg_rating,
                total_ratings            = EXCLUDED.total_ratings,
                rating_distribution      = EXCLUDED.rating_distribution,
                effectiveness_rate       = EXCLUDED.effectiveness_rate,
                difficulty_distribution  = EXCLUDED.difficulty_distribution,
                issue_frequency          = EXCLUDED.issue_frequency,
                satisfaction_trend       = EXCLUDED.satisfaction_trend,
                last_computed_at         = NOW()`,
            [
                materialId,
                analytics.avg_rating,
                analytics.total_ratings,
                JSON.stringify(analytics.rating_distribution),
                analytics.effectiveness_rate,
                JSON.stringify(analytics.difficulty_distribution),
                JSON.stringify(analytics.issue_frequency),
                JSON.stringify(analytics.satisfaction_trend),
            ]
        );

        return analytics;
    }

    static async getCachedAnalytics(materialId) {
        const result = await query(
            `SELECT * FROM material_rating_analytics WHERE material_id = $1`,
            [materialId]
        );
        return result.rows[0] || null;
    }

    // ── Admin-level aggregations ───────────────────────────────────────────────

    static async getSubjectAnalytics(subjectId) {
        const result = await query(
            `SELECT
                m.id               AS material_id,
                m.title,
                m.type,
                a.avg_rating,
                a.total_ratings,
                a.effectiveness_rate,
                a.rating_distribution,
                a.difficulty_distribution,
                a.issue_frequency,
                a.last_computed_at
             FROM materials m
             LEFT JOIN material_rating_analytics a ON a.material_id = m.id
             WHERE m.subject_id = $1
               AND m.deleted_at IS NULL
             ORDER BY a.avg_rating ASC NULLS LAST`,
            [subjectId]
        );
        return result.rows;
    }

    static async getAdminOverview({ limit = 20, minRatings = 1 } = {}) {
        const worst = await query(
            `SELECT
                m.id, m.title, m.type,
                s.id AS subject_id, s.name AS subject_name,
                a.avg_rating, a.total_ratings, a.effectiveness_rate,
                a.issue_frequency, a.last_computed_at
             FROM material_rating_analytics a
             JOIN materials m ON m.id = a.material_id AND m.deleted_at IS NULL
             JOIN subjects s  ON s.id = m.subject_id  AND s.deleted_at IS NULL
             WHERE a.total_ratings >= $1
             ORDER BY a.avg_rating ASC
             LIMIT $2`,
            [minRatings, limit]
        );

        const overall = await query(
            `SELECT
                COUNT(*)::int                            AS total_ratings,
                ROUND(AVG(overall_rating)::numeric, 2)  AS platform_avg_rating,
                COUNT(DISTINCT user_id)::int             AS unique_raters,
                COUNT(DISTINCT material_id)::int         AS rated_materials,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE learning_effectiveness = TRUE)
                    / NULLIF(COUNT(*) FILTER (WHERE learning_effectiveness IS NOT NULL), 0),
                2)                                       AS platform_effectiveness_rate
             FROM material_ratings`
        );

        const bySubject = await query(
            `SELECT
                s.id AS subject_id, s.name AS subject_name,
                COUNT(r.id)::int                            AS total_ratings,
                ROUND(AVG(r.overall_rating)::numeric, 2)   AS avg_rating,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE r.learning_effectiveness = TRUE)
                    / NULLIF(COUNT(*) FILTER (WHERE r.learning_effectiveness IS NOT NULL), 0),
                2)                                          AS effectiveness_rate
             FROM material_ratings r
             JOIN materials m ON m.id = r.material_id AND m.deleted_at IS NULL
             JOIN subjects  s ON s.id = m.subject_id  AND s.deleted_at IS NULL
             GROUP BY s.id, s.name
             ORDER BY avg_rating ASC NULLS LAST`
        );

        return {
            overview:       overall.rows[0],
            worst_materials: worst.rows,
            by_subject:     bySubject.rows,
        };
    }
}

export default RatingModel;
