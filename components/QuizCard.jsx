import Link from 'next/link';
import { LogoMark } from './Logo';
import { mediaUrl } from '@/lib/media';

export function QuizCover({ quiz }) {
  return (
    <div className="quiz-cover">
      {quiz.cover_url ? <img src={mediaUrl(quiz.cover_url)} alt="" loading="lazy" /> : <LogoMark size={64} />}
      <span className="count">{quiz.question_count} întrebări</span>
    </div>
  );
}

export default function QuizCard({ quiz }) {
  const author = quiz.profiles;
  return (
    <article className="quiz-card">
      <Link href={`/biblioteca/${quiz.id}`} tabIndex={-1} aria-hidden>
        <QuizCover quiz={quiz} />
      </Link>
      <div className="quiz-body">
        <h3><Link href={`/biblioteca/${quiz.id}`}>{quiz.title}</Link></h3>
        <div className="quiz-meta">
          {quiz.subject && <span className="tag">{quiz.subject}</span>}
          {quiz.grade_level && <span className="tag gray">{quiz.grade_level}</span>}
        </div>
        {author && (
          <div className="quiz-meta">
            <span>{author.full_name || 'Profesor'}{author.institution ? `, ${author.institution}` : ''}</span>
          </div>
        )}
        <div className="quiz-meta">
          <span>{quiz.plays_count} jocuri</span>
          <span>{quiz.copies_count} copii</span>
        </div>
      </div>
    </article>
  );
}
